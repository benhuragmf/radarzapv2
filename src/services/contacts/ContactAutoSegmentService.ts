import mongoose from 'mongoose';
import { ContactGroup, IContactGroup } from '@/models/ContactGroup';
import { IDestination } from '@/models/Destination';
import {
  SYSTEM_CONTACT_GROUPS,
  SystemContactGroupKey,
  isLeadInboxDepartment,
} from '@/constants/contact-segments';
import { createServiceLogger } from '@/utils/logger';

const logger = createServiceLogger('ContactAutoSegmentService');

export class ContactAutoSegmentService {
  private static instance: ContactAutoSegmentService;

  static getInstance(): ContactAutoSegmentService {
    if (!ContactAutoSegmentService.instance) {
      ContactAutoSegmentService.instance = new ContactAutoSegmentService();
    }
    return ContactAutoSegmentService.instance;
  }

  async ensureSystemGroup(clientId: string, key: SystemContactGroupKey): Promise<IContactGroup> {
    const clientOid = new mongoose.Types.ObjectId(clientId);
    const meta = SYSTEM_CONTACT_GROUPS[key];
    let group = await ContactGroup.findOne({ clientId: clientOid, name: meta.name });
    if (!group) {
      group = await ContactGroup.create({
        clientId: clientOid,
        name: meta.name,
        description: meta.description,
      });
      logger.info('Segmento automático criado', { clientId, group: meta.name });
    } else if (!group.description && meta.description) {
      group.description = meta.description;
      await group.save();
    }
    return group;
  }

  private async addDestinationToGroup(
    dest: IDestination,
    group: IContactGroup,
  ): Promise<boolean> {
    const gid = group._id as mongoose.Types.ObjectId;
    const current = (dest.contactGroupIds ?? []).map(id => id.toString());
    if (current.includes(gid.toString())) return false;
    dest.contactGroupIds = [...(dest.contactGroupIds ?? []), gid];
    await dest.save();
    return true;
  }

  /** Primeiro contato inbound → segmento Atendimento. */
  async tagInboundFirstContact(clientId: string, dest: IDestination): Promise<void> {
    try {
      const group = await this.ensureSystemGroup(clientId, 'ATENDIMENTO');
      const added = await this.addDestinationToGroup(dest, group);
      if (added) {
        logger.info('Contato adicionado ao segmento Atendimento', {
          clientId,
          destinationId: dest._id,
        });
      }
    } catch (err) {
      logger.warn('Falha ao segmentar contato (Atendimento)', err);
    }
  }

  /** Setor comercial na triagem → segmento Lead. */
  async tagLeadFromInboxDepartment(
    clientId: string,
    dest: IDestination,
    departmentName: string,
  ): Promise<void> {
    if (!isLeadInboxDepartment(departmentName)) return;
    try {
      const group = await this.ensureSystemGroup(clientId, 'LEAD');
      const added = await this.addDestinationToGroup(dest, group);
      if (added) {
        logger.info('Contato adicionado ao segmento Lead', {
          clientId,
          destinationId: dest._id,
          department: departmentName,
        });
      }
    } catch (err) {
      logger.warn('Falha ao segmentar contato (Lead)', err);
    }
  }

  /** API / integrações futuras (formulário web → Lead). */
  async tagLeadFromForm(clientId: string, dest: IDestination, source?: string): Promise<void> {
    try {
      const group = await this.ensureSystemGroup(clientId, 'LEAD');
      const added = await this.addDestinationToGroup(dest, group);
      if (added && source) {
        const note = `Lead via ${source}`;
        dest.notes = dest.notes ? `${dest.notes}\n${note}` : note;
        await dest.save();
      }
    } catch (err) {
      logger.warn('Falha ao segmentar Lead (formulário)', err);
    }
  }
}
