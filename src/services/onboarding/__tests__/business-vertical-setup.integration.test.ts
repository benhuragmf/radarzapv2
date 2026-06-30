import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Organization } from '@/models/Organization';
import { InboxDepartment } from '@/models/InboxDepartment';
import { AiKnowledgeBase } from '@/models/AiKnowledgeBase';
import { AiSkill } from '@/models/AiSkill';
import { AiMemory } from '@/models/AiMemory';
import { AiPrompt } from '@/models/AiPrompt';
import { AiSettings } from '@/models/AiSettings';
import { BusinessVerticalSetupService } from '@/services/onboarding/BusinessVerticalSetupService';

const createWidgetMock = jest.fn();

jest.mock('@/services/webchat/WebChatService', () => ({
  WebChatService: {
    getInstance: () => ({
      createWidget: (...args: unknown[]) => createWidgetMock(...args),
    }),
  },
}));

describe('BusinessVerticalSetupService integration', () => {
  let mongo: MongoMemoryServer;
  let clientId: string;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    createWidgetMock.mockImplementation(async (cid: string, data: { name: string; appearance?: object }) => {
      const { WebChatWidget } = jest.requireActual<typeof import('@/models/WebChatWidget')>(
        '@/models/WebChatWidget',
      );
      const { DEFAULT_WEBCHAT_APPEARANCE } = jest.requireActual<typeof import('@/types/webchat')>(
        '@/types/webchat',
      );
      const { generateWebChatPublicKey } = jest.requireActual<
        typeof import('@/services/webchat/webchat-token.util')
      >('@/services/webchat/webchat-token.util');
      return WebChatWidget.create({
        clientId: new mongoose.Types.ObjectId(cid),
        name: data.name,
        publicKey: generateWebChatPublicKey(),
        appearance: { ...DEFAULT_WEBCHAT_APPEARANCE, ...data.appearance },
      });
    });

    await Promise.all([
      Organization.deleteMany({}),
      InboxDepartment.deleteMany({}),
      AiKnowledgeBase.deleteMany({}),
      AiSkill.deleteMany({}),
      AiMemory.deleteMany({}),
      AiPrompt.deleteMany({}),
      AiSettings.deleteMany({}),
    ]);

    const org = await Organization.create({
      ownerUserId: new mongoose.Types.ObjectId(),
      name: 'Clínica Teste',
      plan: 'free',
      limits: { messagesPerDay: 50, groupsMax: 1, templatesMax: 5 },
      usage: { messagesUsed: 0, lastReset: new Date() },
    });
    clientId = org._id.toString();
  });

  it('aplica clínica no plano free com KB, skills, memórias e IA', async () => {
    const svc = BusinessVerticalSetupService.getInstance();
    const result = await svc.applyPreset(clientId, 'clinica');

    expect(result.verticalId).toBe('clinica');
    expect(result.sections.departments).toMatch(/created|replaced/);
    expect(result.sections.knowledgeBase).toBe('seeded');
    expect(result.sections.aiSkills).toBe('seeded');
    expect(result.sections.aiMemories).toBe('seeded');
    expect(result.sections.aiPrompt).toBe('updated');
    expect(result.sections.aiSettings).toBe('updated');

    const clientOid = new mongoose.Types.ObjectId(clientId);
    const [org, kb, skills, memories, prompt, settings, depts] = await Promise.all([
      Organization.findById(clientId).lean(),
      AiKnowledgeBase.countDocuments({ clientId: clientOid }),
      AiSkill.countDocuments({ clientId: clientOid, status: 'approved' }),
      AiMemory.countDocuments({ clientId: clientOid, status: 'approved' }),
      AiPrompt.findOne({ clientId: clientOid }).lean(),
      AiSettings.findOne({ clientId: clientOid }).lean(),
      InboxDepartment.countDocuments({ clientId: clientOid, isActive: true }),
    ]);

    expect(org?.businessVertical).toBe('clinica');
    expect(org?.businessVerticalAppliedAt).toBeTruthy();
    expect(kb).toBeGreaterThan(0);
    expect(skills).toBeGreaterThanOrEqual(2);
    expect(memories).toBeGreaterThanOrEqual(2);
    expect(depts).toBe(4);
    expect(prompt?.customRules).toMatch(/diagnóstico|secretaria/i);
    expect(settings?.attendanceMode).toBe('basic_triage');
  });

  it('rejeita segunda aplicação sem overwrite', async () => {
    const svc = BusinessVerticalSetupService.getInstance();
    await svc.applyPreset(clientId, 'clinica');
    await expect(svc.applyPreset(clientId, 'ecommerce')).rejects.toThrow(/já possui/);
  });

  it('getStatus reflete needsOnboarding', async () => {
    const svc = BusinessVerticalSetupService.getInstance();
    expect((await svc.getStatus(clientId)).needsOnboarding).toBe(true);
    await svc.applyPreset(clientId, 'varejo_fisico');
    const after = await svc.getStatus(clientId);
    expect(after.needsOnboarding).toBe(false);
    expect(after.businessVertical).toBe('varejo_fisico');
  });
});
