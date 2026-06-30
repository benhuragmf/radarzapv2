import crypto from 'crypto';
import mongoose from 'mongoose';

import { RedisManager } from '@/cache/RedisManager';
import { CompanyMember, ICompanyMember } from '@/models/CompanyMember';
import { Organization } from '@/models/Organization';
import { User } from '@/models/User';
import { EmailService } from '@/services/email/EmailService';
import { WhatsAppService } from '@/services/whatsapp/WhatsAppService';
import { createServiceLogger } from '@/utils/logger';
import {
  buildChatDisplayNameProfileFields,
  updateChatDisplayNameByAdmin,
  updateChatDisplayNameSelf,
} from '@/services/organization/chat-display-name.service';
import type { ChatDisplayNamePolicy } from '@/types/chat-display-name';
import { normalizeChatDisplayNamePolicy } from '@/types/chat-display-name';

const logger = createServiceLogger('MemberProfileService');
const OTP_TTL_SEC = 600;
const OTP_COOLDOWN_SEC = 60;

type OtpInitiator = 'self' | 'admin';

interface WaOtpPayload {
  phone: string;
  code: string;
  organizationId: string;
  memberId: string;
  initiatedBy: OtpInitiator;
  adminUserId?: string;
}

interface EmailOtpPayload {
  email: string;
  code: string;
  organizationId: string;
  memberId: string;
}

function waOtpKey(organizationId: string, memberId: string): string {
  return `member:wa-otp:${organizationId}:${memberId}`;
}

function waCooldownKey(organizationId: string, memberId: string): string {
  return `member:wa-otp:cooldown:${organizationId}:${memberId}`;
}

function emailOtpKey(organizationId: string, memberId: string): string {
  return `member:email-otp:${organizationId}:${memberId}`;
}

function emailCooldownKey(organizationId: string, memberId: string): string {
  return `member:email-otp:cooldown:${organizationId}:${memberId}`;
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 20);
  if (digits.length < 10) throw new Error('Número inválido — use DDI + DDD (ex.: 5511999999999)');
  return digits.startsWith('55') ? digits : `55${digits}`;
}

function normalizeEmail(raw: string): string {
  const email = raw.trim().toLowerCase();
  if (!email.includes('@')) throw new Error('E-mail inválido');
  return email;
}

function maskPhone(phone?: string): string | undefined {
  if (!phone) return undefined;
  const d = phone.replace(/\D/g, '');
  if (d.length < 8) return phone;
  return `***${d.slice(-4)}`;
}

function maskEmail(email?: string | null): string | undefined {
  if (!email) return undefined;
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const head = local.length <= 2 ? local[0] ?? '*' : `${local.slice(0, 2)}***`;
  return `${head}@${domain}`;
}

export interface MemberProfileDto {
  email: string | null;
  emailMasked?: string;
  displayName: string | null;
  companyRole: string;
  whatsappPhone?: string;
  whatsappPhoneMasked?: string;
  whatsappPhoneVerified: boolean;
  whatsappPhoneVerifiedAt?: string;
  emailVerified: boolean;
  emailVerifiedAt?: string;
  emailAutoVerifiedByGoogle: boolean;
  allowSelfEdit: boolean;
  canEditProfile: boolean;
  profileComplete: boolean;
  pendingConfirmations: Array<'email' | 'whatsapp'>;
  chatDisplayName: string | null;
  chatDisplayNamePending: string | null;
  chatDisplayNamePendingAt: string | null;
  chatDisplayNamePolicy: ChatDisplayNamePolicy;
  chatDisplayNameEffective: string;
  canEditChatDisplayName: boolean;
  chatDisplayNameAwaitingApproval: boolean;
}

type UserLean = {
  email?: string;
  displayName?: string;
  authProviders?: ('google' | 'discord')[];
};

async function loadOrgTeamSettings(organizationId: string): Promise<{
  allowMembersEditOwnProfile: boolean;
  chatDisplayNamePolicy: ChatDisplayNamePolicy;
}> {
  const org = await Organization.findById(organizationId).select('teamSettings').lean();
  return {
    allowMembersEditOwnProfile: org?.teamSettings?.allowMembersEditOwnProfile === true,
    chatDisplayNamePolicy: normalizeChatDisplayNamePolicy(org?.teamSettings?.chatDisplayNamePolicy),
  };
}

function isGoogleEmailAutoVerified(user: UserLean | null | undefined, member: ICompanyMember): boolean {
  if (!user?.authProviders?.includes('google') || !user.email) return false;
  const memberEmail = (member.email ?? user.email).trim().toLowerCase();
  return user.email.trim().toLowerCase() === memberEmail;
}

async function maybeBackfillGoogleEmailVerification(member: ICompanyMember, user: UserLean | null): Promise<void> {
  if (member.emailVerifiedAt) return;
  if (!isGoogleEmailAutoVerified(user, member)) return;
  member.emailVerifiedAt = new Date();
  await member.save();
}

function buildPendingConfirmations(
  member: ICompanyMember,
  user: UserLean | null,
  emailVerified: boolean,
): Array<'email' | 'whatsapp'> {
  const pending: Array<'email' | 'whatsapp'> = [];
  const hasEmail = Boolean(member.email ?? user?.email);
  if (hasEmail && !emailVerified) pending.push('email');

  const waRequired =
    member.companyRole !== 'OWNER' && member.companyRole !== 'INTEGRATION';
  if (waRequired) {
    if (!member.whatsappPhone || !member.whatsappPhoneVerifiedAt) {
      pending.push('whatsapp');
    }
  }
  return pending;
}

function memberToProfile(
  member: ICompanyMember,
  user: UserLean | null | undefined,
  teamSettings: { allowMembersEditOwnProfile: boolean; chatDisplayNamePolicy: ChatDisplayNamePolicy },
): MemberProfileDto {
  const email = member.email ?? user?.email ?? null;
  const emailAutoVerifiedByGoogle = isGoogleEmailAutoVerified(user, member);
  const emailVerified = Boolean(member.emailVerifiedAt) || emailAutoVerifiedByGoogle;
  const whatsappPhoneVerified = Boolean(member.whatsappPhoneVerifiedAt);
  const pendingConfirmations = buildPendingConfirmations(member, user ?? null, emailVerified);
  const profileComplete = pendingConfirmations.length === 0;
  const allowSelfEdit = teamSettings.allowMembersEditOwnProfile;
  const chatFields = buildChatDisplayNameProfileFields(member, user ?? null, teamSettings.chatDisplayNamePolicy);

  return {
    email,
    emailMasked: maskEmail(email),
    displayName: member.displayName?.trim() || user?.displayName?.trim() || null,
    companyRole: member.companyRole,
    whatsappPhone: member.whatsappPhone,
    whatsappPhoneMasked: maskPhone(member.whatsappPhone),
    whatsappPhoneVerified,
    whatsappPhoneVerifiedAt: member.whatsappPhoneVerifiedAt?.toISOString(),
    emailVerified,
    emailVerifiedAt: member.emailVerifiedAt?.toISOString(),
    emailAutoVerifiedByGoogle,
    allowSelfEdit,
    canEditProfile: allowSelfEdit && member.companyRole !== 'OWNER',
    profileComplete,
    pendingConfirmations,
    ...chatFields,
  };
}

async function loadMemberById(organizationId: string, memberId: string): Promise<ICompanyMember> {
  const member = await CompanyMember.findOne({
    _id: memberId,
    organizationId: new mongoose.Types.ObjectId(organizationId),
    isActive: true,
  });
  if (!member) throw new Error('Membro não encontrado');
  return member;
}

async function loadMemberByUserId(organizationId: string, userId: string): Promise<ICompanyMember> {
  const member = await CompanyMember.findOne({
    userId: new mongoose.Types.ObjectId(userId),
    organizationId: new mongoose.Types.ObjectId(organizationId),
    isActive: true,
  });
  if (!member) throw new Error('Membro não encontrado nesta empresa');
  return member;
}

async function loadUserForMember(member: ICompanyMember): Promise<UserLean | null> {
  if (!member.userId) return null;
  return User.findById(member.userId).select('email displayName authProviders').lean();
}

async function notifyOwnerVerificationAudit(
  organizationId: string,
  member: ICompanyMember,
  maskedPhone: string,
  adminUserId: string,
): Promise<void> {
  try {
    const org = await Organization.findById(organizationId).select('ownerUserId name').lean();
    if (!org?.ownerUserId) return;

    const ownerMember = await CompanyMember.findOne({
      organizationId: new mongoose.Types.ObjectId(organizationId),
      userId: org.ownerUserId,
      isActive: true,
      whatsappPhoneVerifiedAt: { $exists: true, $ne: null },
    })
      .select('whatsappPhone')
      .lean();

    if (!ownerMember?.whatsappPhone) return;

    const admin = await User.findById(adminUserId).select('displayName email').lean();
    const adminLabel = admin?.displayName?.trim() || admin?.email?.split('@')[0] || 'Administrador';
    const memberLabel = member.displayName ?? member.email ?? 'membro da equipe';

    const wa = WhatsAppService.getInstance();
    if (!wa.isClientConnected(organizationId)) return;

    await wa.sendOperationalTextMessage(
      organizationId,
      ownerMember.whatsappPhone!,
      `*Radar Chat* — auditoria de cadastro WhatsApp\n\n` +
        `${adminLabel} solicitou verificar o número ${maskedPhone} para *${memberLabel}*.\n\n` +
        `Um código de segurança foi enviado ao número informado. ` +
        `O titular deve confirmar o código para concluir o cadastro.`,
    );
  } catch (err) {
    logger.warn('Falha ao notificar dono sobre verificação WA', {
      organizationId,
      error: (err as Error).message,
    });
  }
}

async function sendWhatsappVerificationOtp(
  member: ICompanyMember,
  organizationId: string,
  rawPhone: string,
  initiatedBy: OtpInitiator,
  adminUserId?: string,
): Promise<{ ok: true; maskedPhone: string; expiresInSec: number }> {
  const phone = normalizePhone(rawPhone);
  const memberId = String(member._id);
  const redis = RedisManager.getInstance();

  const cooldown = await redis.get(waCooldownKey(organizationId, memberId));
  if (cooldown) {
    throw new Error('Aguarde 1 minuto antes de solicitar outro código');
  }

  const wa = WhatsAppService.getInstance();
  if (!wa.isClientConnected(organizationId)) {
    throw new Error('WhatsApp da empresa desconectado — não é possível enviar o código agora');
  }

  const code = String(crypto.randomInt(100_000, 999_999));
  const payload: WaOtpPayload = {
    phone,
    code,
    organizationId,
    memberId,
    initiatedBy,
    adminUserId,
  };

  await redis.setWithTTL(waOtpKey(organizationId, memberId), JSON.stringify(payload), OTP_TTL_SEC);
  await redis.setWithTTL(waCooldownKey(organizationId, memberId), '1', OTP_COOLDOWN_SEC);

  const message =
    initiatedBy === 'admin'
      ? `*Radar Chat* — verificação de WhatsApp (cadastro pela empresa)\n\n` +
        `Foi solicitado vincular este número ao atendimento da equipe.\n\n` +
        `*Código de segurança: ${code}*\n\n` +
        `Válido por 10 minutos. Informe o código ao responsável da empresa para concluir. ` +
        `Se não reconhece este pedido, ignore.`
      : `*Radar Chat* — confirme seu WhatsApp pessoal\n\n` +
        `*Código de segurança: ${code}*\n\n` +
        `Válido por 10 minutos. Se não foi você, ignore esta mensagem.`;

  try {
    await wa.sendOperationalTextMessage(organizationId, phone, message);
  } catch (err) {
    await redis.deleteKey(waOtpKey(organizationId, memberId));
    logger.warn('Falha ao enviar OTP WhatsApp', { memberId, error: (err as Error).message });
    const msg = (err as Error).message;
    throw new Error(
      msg.includes('WhatsApp') || msg.includes('DDI')
        ? msg
        : 'Não foi possível enviar o código para este número. Verifique o DDI/DDD e se o WhatsApp está conectado.',
    );
  }

  if (initiatedBy === 'admin' && adminUserId) {
    await notifyOwnerVerificationAudit(organizationId, member, maskPhone(phone) ?? phone, adminUserId);
  }

  return { ok: true, maskedPhone: maskPhone(phone) ?? phone, expiresInSec: OTP_TTL_SEC };
}

async function confirmWhatsappOtp(
  member: ICompanyMember,
  organizationId: string,
  rawPhone: string,
  code: string,
): Promise<MemberProfileDto> {
  const phone = normalizePhone(rawPhone);
  const memberId = String(member._id);
  const redis = RedisManager.getInstance();
  const raw = await redis.get(waOtpKey(organizationId, memberId));
  if (!raw) throw new Error('Código expirado ou não solicitado');

  let payload: WaOtpPayload;
  try {
    payload = JSON.parse(raw) as WaOtpPayload;
  } catch {
    throw new Error('Código inválido');
  }

  if (payload.organizationId !== organizationId || payload.memberId !== memberId) {
    throw new Error('Código inválido para este membro');
  }
  if (payload.phone !== phone) {
    throw new Error('Número não confere com o código enviado');
  }
  if (payload.code !== String(code).trim()) {
    throw new Error('Código incorreto');
  }

  member.whatsappPhone = phone;
  member.whatsappPhoneVerifiedAt = new Date();
  await member.save();
  await redis.deleteKey(waOtpKey(organizationId, memberId));

  const [user, teamSettings] = await Promise.all([
    loadUserForMember(member),
    loadOrgTeamSettings(organizationId),
  ]);
  return memberToProfile(member, user, teamSettings);
}

async function sendEmailVerificationOtp(
  member: ICompanyMember,
  organizationId: string,
  targetEmail: string,
): Promise<{ ok: true; maskedEmail: string; expiresInSec: number }> {
  const email = normalizeEmail(targetEmail);
  const memberId = String(member._id);
  const redis = RedisManager.getInstance();

  const cooldown = await redis.get(emailCooldownKey(organizationId, memberId));
  if (cooldown) {
    throw new Error('Aguarde 1 minuto antes de solicitar outro código');
  }

  const emailSvc = EmailService.getInstance();
  if (!emailSvc.isConfigured() && process.env.NODE_ENV === 'production') {
    throw new Error('Envio de e-mail não configurado — contate o administrador');
  }

  const code = String(crypto.randomInt(100_000, 999_999));
  const payload: EmailOtpPayload = { email, code, organizationId, memberId };

  await redis.setWithTTL(emailOtpKey(organizationId, memberId), JSON.stringify(payload), OTP_TTL_SEC);
  await redis.setWithTTL(emailCooldownKey(organizationId, memberId), '1', OTP_COOLDOWN_SEC);

  const org = await Organization.findById(organizationId).select('name').lean();
  const orgName = org?.name?.trim() || 'Radar Chat';
  const subject = `${orgName} — confirme seu e-mail`;
  const text =
    `Código de segurança Radar Chat: ${code}\n\n` +
    `Válido por 10 minutos. Se não foi você, ignore este e-mail.`;
  const html =
    `<p>Confirme seu e-mail na equipe <strong>${orgName}</strong>.</p>` +
    `<p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p>` +
    `<p>Válido por 10 minutos. Se não foi você, ignore.</p>`;

  const result = await emailSvc.send({ to: email, subject, text, html });
  if (!result.ok) {
    await redis.deleteKey(emailOtpKey(organizationId, memberId));
    throw new Error(result.error ?? 'Não foi possível enviar o código por e-mail');
  }

  return { ok: true, maskedEmail: maskEmail(email) ?? email, expiresInSec: OTP_TTL_SEC };
}

async function confirmEmailOtp(
  member: ICompanyMember,
  organizationId: string,
  rawEmail: string,
  code: string,
  allowEmailChange: boolean,
): Promise<MemberProfileDto> {
  const email = normalizeEmail(rawEmail);
  const memberId = String(member._id);
  const redis = RedisManager.getInstance();
  const raw = await redis.get(emailOtpKey(organizationId, memberId));
  if (!raw) throw new Error('Código expirado ou não solicitado');

  let payload: EmailOtpPayload;
  try {
    payload = JSON.parse(raw) as EmailOtpPayload;
  } catch {
    throw new Error('Código inválido');
  }

  if (payload.organizationId !== organizationId || payload.memberId !== memberId) {
    throw new Error('Código inválido para este membro');
  }
  if (payload.email !== email) {
    throw new Error('E-mail não confere com o código enviado');
  }
  if (payload.code !== String(code).trim()) {
    throw new Error('Código incorreto');
  }

  const emailChanged = member.email !== email;
  if (emailChanged && !allowEmailChange) {
    throw new Error('Sua empresa não permite alterar o e-mail');
  }

  member.email = email;
  member.emailVerifiedAt = new Date();
  await member.save();
  await redis.deleteKey(emailOtpKey(organizationId, memberId));

  const [user, teamSettings] = await Promise.all([
    loadUserForMember(member),
    loadOrgTeamSettings(organizationId),
  ]);
  return memberToProfile(member, user, teamSettings);
}

async function assertSelfWhatsappAllowed(
  member: ICompanyMember,
  organizationId: string,
  rawPhone: string,
): Promise<void> {
  const { allowMembersEditOwnProfile } = await loadOrgTeamSettings(organizationId);
  if (allowMembersEditOwnProfile) return;

  if (!member.whatsappPhone) {
    throw new Error('WhatsApp será cadastrado pela empresa. Aguarde ou peça ao administrador.');
  }
  const phone = normalizePhone(rawPhone);
  const registered = normalizePhone(member.whatsappPhone);
  if (phone !== registered) {
    throw new Error('Sua empresa não permite alterar o número — confirme o WhatsApp cadastrado.');
  }
}

export async function getMemberProfile(
  userId: string,
  organizationId: string,
): Promise<MemberProfileDto> {
  const member = await loadMemberByUserId(organizationId, userId);
  const user = await loadUserForMember(member);
  await maybeBackfillGoogleEmailVerification(member, user);
  const teamSettings = await loadOrgTeamSettings(organizationId);
  return memberToProfile(member, user, teamSettings);
}

export async function getMemberProfileByMemberId(
  organizationId: string,
  memberId: string,
): Promise<MemberProfileDto> {
  const member = await loadMemberById(organizationId, memberId);
  const user = await loadUserForMember(member);
  await maybeBackfillGoogleEmailVerification(member, user);
  const teamSettings = await loadOrgTeamSettings(organizationId);
  return memberToProfile(member, user, teamSettings);
}

export async function getTeamSettings(organizationId: string): Promise<{
  allowMembersEditOwnProfile: boolean;
  chatDisplayNamePolicy: ChatDisplayNamePolicy;
}> {
  return loadOrgTeamSettings(organizationId);
}

export async function updateTeamSettings(
  organizationId: string,
  patch: {
    allowMembersEditOwnProfile?: boolean;
    chatDisplayNamePolicy?: ChatDisplayNamePolicy;
  },
): Promise<{
  allowMembersEditOwnProfile: boolean;
  chatDisplayNamePolicy: ChatDisplayNamePolicy;
}> {
  const org = await Organization.findById(organizationId);
  if (!org) throw new Error('Empresa não encontrada');
  if (!org.teamSettings) {
    org.teamSettings = { allowMembersEditOwnProfile: false, chatDisplayNamePolicy: 'self_service' };
  }
  if (patch.allowMembersEditOwnProfile !== undefined) {
    org.teamSettings.allowMembersEditOwnProfile = patch.allowMembersEditOwnProfile;
  }
  if (patch.chatDisplayNamePolicy !== undefined) {
    org.teamSettings.chatDisplayNamePolicy = normalizeChatDisplayNamePolicy(patch.chatDisplayNamePolicy);
  }
  org.markModified('teamSettings');
  await org.save();
  return loadOrgTeamSettings(organizationId);
}

export async function updateMemberProfileByAdmin(
  organizationId: string,
  memberId: string,
  patch: {
    displayName?: string | null;
    email?: string | null;
    whatsappPhone?: string | null;
    chatDisplayName?: string | null;
  },
): Promise<MemberProfileDto> {
  let member = await loadMemberById(organizationId, memberId);
  if (member.companyRole === 'OWNER') {
    throw new Error('Use Meu perfil para alterar dados do dono');
  }

  if (patch.chatDisplayName !== undefined) {
    await updateChatDisplayNameByAdmin(organizationId, memberId, patch.chatDisplayName);
    member = await loadMemberById(organizationId, memberId);
  }

  if (patch.displayName !== undefined) {
    const trimmed = patch.displayName?.trim() ?? '';
    member.displayName = trimmed ? trimmed.slice(0, 120) : undefined;
  }

  if (patch.email !== undefined) {
    const next = patch.email?.trim().toLowerCase() ?? '';
    if (next && !next.includes('@')) throw new Error('E-mail inválido');
    const changed = (member.email ?? '') !== next;
    member.email = next || undefined;
    if (changed) member.emailVerifiedAt = undefined;
  }

  if (patch.whatsappPhone !== undefined) {
    const next = patch.whatsappPhone?.trim()
      ? normalizePhone(patch.whatsappPhone)
      : undefined;
    const changed = (member.whatsappPhone ?? '') !== (next ?? '');
    member.whatsappPhone = next;
    if (changed) member.whatsappPhoneVerifiedAt = undefined;
  }

  if (
    patch.displayName !== undefined ||
    patch.email !== undefined ||
    patch.whatsappPhone !== undefined
  ) {
    await member.save();
  }

  const user = await loadUserForMember(member);
  const teamSettings = await loadOrgTeamSettings(organizationId);
  return memberToProfile(member, user, teamSettings);
}

export async function updateMemberProfileSelf(
  userId: string,
  organizationId: string,
  patch: { displayName?: string | null; chatDisplayName?: string | null },
): Promise<MemberProfileDto> {
  const teamSettings = await loadOrgTeamSettings(organizationId);

  if (patch.chatDisplayName !== undefined && patch.chatDisplayName !== null) {
    await updateChatDisplayNameSelf(userId, organizationId, patch.chatDisplayName);
  }

  if (patch.displayName !== undefined) {
    const member = await loadMemberByUserId(organizationId, userId);
    if (!teamSettings.allowMembersEditOwnProfile) {
      throw new Error('Sua empresa não permite editar seus dados — confirme e-mail e WhatsApp abaixo.');
    }
    if (member.companyRole === 'OWNER') {
      throw new Error('Dono edita nome em Conta vinculada');
    }
    const trimmed = patch.displayName?.trim() ?? '';
    member.displayName = trimmed ? trimmed.slice(0, 120) : undefined;
    await member.save();
  }

  const member = await loadMemberByUserId(organizationId, userId);
  const user = await loadUserForMember(member);
  return memberToProfile(member, user, teamSettings);
}

export async function requestWhatsappVerification(
  userId: string,
  organizationId: string,
  rawPhone: string,
): Promise<{ ok: true; maskedPhone: string; expiresInSec: number }> {
  const member = await loadMemberByUserId(organizationId, userId);
  await assertSelfWhatsappAllowed(member, organizationId, rawPhone);
  return sendWhatsappVerificationOtp(member, organizationId, rawPhone, 'self');
}

export async function confirmWhatsappVerification(
  userId: string,
  organizationId: string,
  rawPhone: string,
  code: string,
): Promise<MemberProfileDto> {
  const member = await loadMemberByUserId(organizationId, userId);
  await assertSelfWhatsappAllowed(member, organizationId, rawPhone);
  return confirmWhatsappOtp(member, organizationId, rawPhone, code);
}

export async function requestEmailVerification(
  userId: string,
  organizationId: string,
  rawEmail?: string,
): Promise<{ ok: true; maskedEmail: string; expiresInSec: number }> {
  const member = await loadMemberByUserId(organizationId, userId);
  const user = await loadUserForMember(member);
  const teamSettings = await loadOrgTeamSettings(organizationId);

  if (isGoogleEmailAutoVerified(user, member)) {
    throw new Error('E-mail já confirmado pelo login Google');
  }

  let target = rawEmail?.trim() ? normalizeEmail(rawEmail) : member.email ?? user?.email ?? '';
  if (!target) throw new Error('E-mail não cadastrado — peça ao administrador');

  if (!teamSettings.allowMembersEditOwnProfile && rawEmail) {
    const registered = (member.email ?? user?.email ?? '').trim().toLowerCase();
    if (normalizeEmail(rawEmail) !== registered) {
      throw new Error('Sua empresa não permite alterar o e-mail — confirme o cadastrado.');
    }
  }

  if (teamSettings.allowMembersEditOwnProfile && rawEmail) {
    target = normalizeEmail(rawEmail);
  }

  return sendEmailVerificationOtp(member, organizationId, target);
}

export async function confirmEmailVerification(
  userId: string,
  organizationId: string,
  rawEmail: string,
  code: string,
): Promise<MemberProfileDto> {
  const member = await loadMemberByUserId(organizationId, userId);
  const teamSettings = await loadOrgTeamSettings(organizationId);
  return confirmEmailOtp(member, organizationId, rawEmail, code, teamSettings.allowMembersEditOwnProfile);
}

export async function requestMemberWhatsappVerificationByAdmin(
  organizationId: string,
  memberId: string,
  adminUserId: string,
  rawPhone: string,
): Promise<{ ok: true; maskedPhone: string; expiresInSec: number }> {
  const member = await loadMemberById(organizationId, memberId);
  if (member.companyRole === 'OWNER') {
    throw new Error('Use Meu perfil para alterar o WhatsApp do dono');
  }
  return sendWhatsappVerificationOtp(member, organizationId, rawPhone, 'admin', adminUserId);
}

export async function confirmMemberWhatsappVerificationByAdmin(
  organizationId: string,
  memberId: string,
  rawPhone: string,
  code: string,
): Promise<MemberProfileDto> {
  const member = await loadMemberById(organizationId, memberId);
  return confirmWhatsappOtp(member, organizationId, rawPhone, code);
}

export async function clearMemberWhatsappPhone(
  userId: string,
  organizationId: string,
): Promise<MemberProfileDto> {
  const member = await loadMemberByUserId(organizationId, userId);
  const teamSettings = await loadOrgTeamSettings(organizationId);
  if (!teamSettings.allowMembersEditOwnProfile) {
    throw new Error('Sua empresa não permite remover o WhatsApp — fale com o administrador.');
  }
  return clearWhatsappForMember(member, organizationId);
}

export async function clearMemberWhatsappPhoneByAdmin(
  organizationId: string,
  memberId: string,
): Promise<MemberProfileDto> {
  const member = await loadMemberById(organizationId, memberId);
  if (member.companyRole === 'OWNER') {
    throw new Error('Não é possível remover o WhatsApp do dono por aqui');
  }
  return clearWhatsappForMember(member, organizationId);
}

async function clearWhatsappForMember(
  member: ICompanyMember,
  organizationId: string,
): Promise<MemberProfileDto> {
  member.whatsappPhone = undefined;
  member.whatsappPhoneVerifiedAt = undefined;
  await member.save();
  await RedisManager.getInstance().deleteKey(waOtpKey(organizationId, String(member._id)));

  const user = await loadUserForMember(member);
  const teamSettings = await loadOrgTeamSettings(organizationId);
  return memberToProfile(member, user, teamSettings);
}
