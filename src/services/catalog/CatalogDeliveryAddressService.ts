/**
 * Normalizador Endereço de Entrega v1 — CEP, pin, texto livre e confirmação.
 */

import type { BrCepLookupResult } from '@/utils/br-cep.util';
import { lookupBrCep } from '@/utils/br-cep.util';
import {
  buildDeliveryAddressFromCepAndNumber,
  mergeLocationConfirmReply,
  parseStreetNumberReply,
  reverseGeocodeCoords,
} from '@/utils/catalog-delivery.util';
import {
  isGeocodableCustomerAddress,
  parseLooseDeliveryAddress,
  storedValueIsCepOnly,
  textIsCepOnly,
  textLooksLikeStreetNumber,
} from '@/types/catalog-delivery-address';
import {
  backfillDeliveryAddressV1FromLegacy,
  buildAddressConfirmationRequestMessage,
  buildCepOfferAllowedReply,
  buildGeocodingFailedHumanMessage,
  buildPinNeedsStreetNumberMessage,
  createDeliveryAddressSnapshot,
  deliveryAddressV1NeedsConfirmation,
  formatAddressConfirmationLine,
  isDeliveryAddressV1Confirmed,
  mergePinReverseIntoV1,
  structuredToDeliveryAddressV1,
  syncLegacyFieldsFromV1,
  textIsAddressConfirmationNo,
  textIsAddressConfirmationYes,
  type DeliveryAddressSnapshot,
  type DeliveryAddressV1,
  type DeliveryAddressV1Source,
} from '@/types/catalog-delivery-address-v1';
import type { ICatalogSalesOrder } from '@/models/CatalogSalesOrder';
import { detectCatalogCepOfferQuestion } from '@/types/catalog-sales';

export type AddressProcessAction =
  | 'unhandled'
  | 'reply'
  | 'needs_confirmation'
  | 'confirmed'
  | 'escalate_human'
  | 'request_correction';

export interface AddressProcessResult {
  handled: boolean;
  action: AddressProcessAction;
  reply?: string;
  v1?: DeliveryAddressV1;
  snapshot?: DeliveryAddressSnapshot;
}

export interface AddressProcessContext {
  clientText: string;
  contactFirstName?: string;
  companyCity?: string;
  companyUf?: string;
}

export class CatalogDeliveryAddressService {
  ensureV1(order: ICatalogSalesOrder): DeliveryAddressV1 {
    if (order.deliveryAddressV1?.status && order.deliveryAddressV1.status !== 'empty') {
      return order.deliveryAddressV1 as DeliveryAddressV1;
    }
    const backfill = backfillDeliveryAddressV1FromLegacy(order);
    if (backfill) {
      order.deliveryAddressV1 = backfill;
      return backfill;
    }
    const empty: DeliveryAddressV1 = { status: 'empty', normalizedAt: new Date() };
    order.deliveryAddressV1 = empty;
    return empty;
  }

  applyV1ToOrder(order: ICatalogSalesOrder, v1: DeliveryAddressV1): void {
    order.deliveryAddressV1 = v1;
    const legacy = syncLegacyFieldsFromV1(v1);
    if (legacy.deliveryAddress) order.deliveryAddress = legacy.deliveryAddress;
    if (legacy.deliveryLocationLat != null) order.deliveryLocationLat = legacy.deliveryLocationLat;
    if (legacy.deliveryLocationLng != null) order.deliveryLocationLng = legacy.deliveryLocationLng;
    order.deliveryLocationPendingConfirm = legacy.deliveryLocationPendingConfirm ?? false;
  }

  async processClientInput(
    order: ICatalogSalesOrder,
    ctx: AddressProcessContext,
  ): Promise<AddressProcessResult> {
    const text = ctx.clientText.trim();
    if (!text) return { handled: false, action: 'unhandled' };

    const v1 = this.ensureV1(order);

    if (detectCatalogCepOfferQuestion(text)) {
      return { handled: true, action: 'reply', reply: buildCepOfferAllowedReply(), v1 };
    }

    if (deliveryAddressV1NeedsConfirmation(v1)) {
      return this.processConfirmationReply(order, v1, ctx);
    }

    if (textIsCepOnly(text)) {
      return this.processCepOnly(order, text, v1);
    }

    if (textLooksLikeStreetNumber(text) && storedValueIsCepOnly(order.deliveryAddress)) {
      return this.processCepPlusNumber(order, order.deliveryAddress ?? '', text, v1);
    }

    if (order.deliveryLocationPendingConfirm || v1.status === 'partial') {
      const pinResult = await this.processPinStreetReply(order, text, v1);
      if (pinResult.handled) return pinResult;
    }

    const streetParsed = parseStreetNumberReply(text);
    if (streetParsed && order.deliveryLocationLat != null && order.deliveryLocationLng != null) {
      return this.processPinStreetReply(order, text, v1);
    }

    if (isGeocodableCustomerAddress(text)) {
      return this.processFreeText(order, text, v1, ctx);
    }

    return { handled: false, action: 'unhandled', v1 };
  }

  private async processConfirmationReply(
    order: ICatalogSalesOrder,
    v1: DeliveryAddressV1,
    ctx: AddressProcessContext,
  ): Promise<AddressProcessResult> {
    const text = ctx.clientText.trim();
    if (textIsAddressConfirmationYes(text)) {
      const confirmed: DeliveryAddressV1 = {
        ...v1,
        status: 'confirmed',
        confirmedBy: 'customer',
        confirmedAt: new Date(),
        needsHumanReview: false,
      };
      this.applyV1ToOrder(order, confirmed);
      return { handled: true, action: 'confirmed', v1: confirmed };
    }
    if (textIsAddressConfirmationNo(text)) {
      const partial: DeliveryAddressV1 = {
        ...v1,
        status: 'partial',
        missingFields: ['street', 'number'],
      };
      this.applyV1ToOrder(order, partial);
      const prefix = ctx.contactFirstName?.trim() ? `${ctx.contactFirstName.trim()}, ` : '';
      return {
        handled: true,
        action: 'request_correction',
        reply: `${prefix}Sem problemas. Me envie o endereço corrigido (rua, número, bairro e cidade).`,
        v1: partial,
      };
    }

    const correction = await this.processFreeText(order, text, { ...v1, status: 'partial' }, ctx);
    if (correction.handled) return correction;

    return {
      handled: true,
      action: 'reply',
      reply: buildAddressConfirmationRequestMessage(v1),
      v1,
    };
  }

  private async processCepOnly(
    order: ICatalogSalesOrder,
    text: string,
    v1: DeliveryAddressV1,
  ): Promise<AddressProcessResult> {
    const lookup = await lookupBrCep(text);
    if (!lookup) {
      return {
        handled: true,
        action: 'reply',
        reply: 'Não consegui localizar esse CEP. Confira os 8 dígitos ou envie o endereço completo.',
        v1,
      };
    }
    const next = this.v1FromCepLookup(lookup, text, 'cep');
    next.status = 'partial';
    next.missingFields = ['number'];
    this.applyV1ToOrder(order, next);
    return {
      handled: true,
      action: 'reply',
      reply: this.buildCepFoundMessage(lookup),
      v1: next,
    };
  }

  private buildCepFoundMessage(lookup: BrCepLookupResult): string {
    const cityUf = `${lookup.city}-${lookup.state}`;
    const street = lookup.street.trim() || 'Logradouro';
    const hood = lookup.neighborhood.trim() || 'Centro';
    return (
      `Encontrei este endereço: *${street}*, bairro *${hood}*, *${cityUf}*. ` +
      'Qual o *número* do imóvel?'
    );
  }

  private async processCepPlusNumber(
    order: ICatalogSalesOrder,
    cepStored: string,
    numberText: string,
    v1: DeliveryAddressV1,
  ): Promise<AddressProcessResult> {
    const full = await buildDeliveryAddressFromCepAndNumber(cepStored, numberText);
    if (!full) {
      return {
        handled: true,
        action: 'reply',
        reply: 'Não consegui montar o endereço com esse CEP e número. Confira os dados.',
        v1,
      };
    }
    const structured = parseLooseDeliveryAddress(full);
    if (!structured) {
      return { handled: true, action: 'escalate_human', v1 };
    }
    const next = structuredToDeliveryAddressV1(structured, {
      source: 'cep',
      rawText: `${cepStored} ${numberText}`,
      status: 'needs_confirmation',
      confidence: 'high',
    });
    this.applyV1ToOrder(order, next);
    return {
      handled: true,
      action: 'needs_confirmation',
      reply: buildAddressConfirmationRequestMessage(next),
      v1: next,
    };
  }

  async processPinLocation(
    order: ICatalogSalesOrder,
    lat: number,
    lng: number,
    waAddress?: string,
    isLive?: boolean,
  ): Promise<AddressProcessResult> {
    const reverse = await reverseGeocodeCoords(lat, lng);
    let v1: DeliveryAddressV1 = {
      latitude: lat,
      longitude: lng,
      source: 'whatsapp_pin',
      confidence: reverse ? 'medium' : 'low',
      status: 'partial',
      rawText: waAddress,
      normalizedAt: new Date(),
      reverseGeocodeStatus: reverse ? 'ok' : 'failed',
      missingFields: ['street', 'number'],
    };
    if (reverse) v1 = mergePinReverseIntoV1(v1, reverse);
    if (waAddress?.trim()) v1.formattedAddress = waAddress.trim().slice(0, 500);

    const needsStreetNumber =
      isLive ||
      !v1.number?.trim() ||
      !v1.street?.trim() ||
      /^Localização GPS/i.test(v1.formattedAddress ?? '');

    if (needsStreetNumber) {
      v1.status = 'partial';
      this.applyV1ToOrder(order, v1);
      return {
        handled: true,
        action: 'reply',
        reply: buildPinNeedsStreetNumberMessage(),
        v1,
      };
    }

    v1.status = 'needs_confirmation';
    this.applyV1ToOrder(order, v1);
    return {
      handled: true,
      action: 'needs_confirmation',
      reply: buildAddressConfirmationRequestMessage(v1),
      v1,
    };
  }

  private async processPinStreetReply(
    order: ICatalogSalesOrder,
    text: string,
    v1: DeliveryAddressV1,
  ): Promise<AddressProcessResult> {
    const lat = order.deliveryLocationLat;
    const lng = order.deliveryLocationLng;
    const reverse = lat != null && lng != null ? await reverseGeocodeCoords(lat, lng) : null;
    const merged = mergeLocationConfirmReply(text, reverse, {
      displayAddress: order.deliveryAddress,
    });
    if (!merged) {
      order.addressConfirmAttempts = (order.addressConfirmAttempts ?? 0) + 1;
      const attempt = order.addressConfirmAttempts;
      if (attempt >= 3) {
        const human: DeliveryAddressV1 = { ...v1, status: 'needs_human_review', needsHumanReview: true };
        this.applyV1ToOrder(order, human);
        return {
          handled: true,
          action: 'escalate_human',
          reply: buildGeocodingFailedHumanMessage(),
          v1: human,
        };
      }
      return {
        handled: true,
        action: 'reply',
        reply:
          attempt >= 2
            ? 'Se preferir, envie só o *CEP* (8 dígitos) para ajudar na localização.'
            : 'Ainda preciso da *rua* e do *número*. Ex.: *Rua José Pinto, 120*.',
        v1,
      };
    }

    const loose = parseLooseDeliveryAddress(merged);
    const base = loose
      ? structuredToDeliveryAddressV1(loose, {
          source: 'text_after_pin',
          rawText: text,
          lat: lat ?? undefined,
          lng: lng ?? undefined,
          status: 'needs_confirmation',
          confidence: 'high',
        })
      : ({
          ...v1,
          rawText: text,
          formattedAddress: merged,
          source: 'text_after_pin' as DeliveryAddressV1Source,
          status: 'needs_confirmation' as const,
        } satisfies DeliveryAddressV1);

    if (reverse) mergePinReverseIntoV1(base, reverse);
    order.addressConfirmAttempts = 0;
    order.deliveryLocationPendingConfirm = false;
    this.applyV1ToOrder(order, base);
    return {
      handled: true,
      action: 'needs_confirmation',
      reply: buildAddressConfirmationRequestMessage(base),
      v1: base,
    };
  }

  private async processFreeText(
    order: ICatalogSalesOrder,
    text: string,
    v1: DeliveryAddressV1,
    ctx: AddressProcessContext,
  ): Promise<AddressProcessResult> {
    const loose = parseLooseDeliveryAddress(text);
    if (!loose?.number?.trim()) {
      const partial: DeliveryAddressV1 = {
        ...v1,
        rawText: text,
        status: 'partial',
        missingFields: ['number'],
      };
      this.applyV1ToOrder(order, partial);
      return {
        handled: true,
        action: 'reply',
        reply: 'Consegui identificar a rua, mas falta o *número* do imóvel. Me envie somente o número, por favor.',
        v1: partial,
      };
    }

    let confidence: DeliveryAddressV1['confidence'] = 'high';
    if (!loose.city?.trim() && ctx.companyCity) {
      loose.city = ctx.companyCity;
      confidence = 'medium';
    }
    if (!loose.state?.trim() && ctx.companyUf) {
      loose.state = ctx.companyUf;
      confidence = 'medium';
    }

    const next = structuredToDeliveryAddressV1(loose, {
      source: order.deliveryLocationLat != null ? 'text_after_pin' : 'text',
      rawText: text,
      lat: order.deliveryLocationLat ?? undefined,
      lng: order.deliveryLocationLng ?? undefined,
      status: 'needs_confirmation',
      confidence,
    });
    this.applyV1ToOrder(order, next);
    return {
      handled: true,
      action: 'needs_confirmation',
      reply: buildAddressConfirmationRequestMessage(next),
      v1: next,
    };
  }

  v1FromCepLookup(lookup: BrCepLookupResult, rawCep: string, source: DeliveryAddressV1Source): DeliveryAddressV1 {
    return structuredToDeliveryAddressV1(
      {
        cep: lookup.cep,
        street: lookup.street.trim() || 'Logradouro',
        number: '',
        neighborhood: lookup.neighborhood.trim() || 'Centro',
        city: lookup.city,
        state: lookup.state,
        country: 'Brasil',
        complement: lookup.complement,
      },
      { source, rawText: rawCep, status: 'partial', confidence: 'high', missingFields: ['number'] },
    );
  }

  markFreightConfirmed(order: ICatalogSalesOrder): DeliveryAddressSnapshot | undefined {
    const v1 = order.deliveryAddressV1 as DeliveryAddressV1 | undefined;
    if (!v1) return undefined;
    const confirmed: DeliveryAddressV1 = {
      ...v1,
      status: 'freight_confirmed',
      freightRuleVersion: 'distance_km_v1',
    };
    this.applyV1ToOrder(order, confirmed);
    const snapshot = createDeliveryAddressSnapshot({
      v1: confirmed,
      order,
      freightRuleVersion: 'distance_km_v1',
    });
    order.deliveryAddressSnapshot = snapshot;
    return snapshot;
  }

  applyOperatorCorrection(
    order: ICatalogSalesOrder,
    payload: Partial<DeliveryAddressV1>,
    operatorUserId?: string,
  ): DeliveryAddressV1 {
    const current = this.ensureV1(order);
    const next: DeliveryAddressV1 = {
      ...current,
      ...payload,
      source: 'operator',
      status: 'confirmed',
      confirmedBy: 'operator',
      confirmedAt: new Date(),
      normalizedAt: new Date(),
      needsHumanReview: false,
      notes: payload.notes ?? current.notes,
    };
    if (next.street && next.number && next.city && (next.uf ?? next.state)) {
      next.formattedAddress = formatAddressConfirmationLine(next);
    }
    this.applyV1ToOrder(order, next);
    order.history.push({
      at: new Date(),
      action: 'delivery_address_operator_corrected',
      actorUserId: operatorUserId,
      note: next.formattedAddress?.slice(0, 200),
    });
    return next;
  }

  canProceedToFreight(v1?: DeliveryAddressV1 | null): boolean {
    return isDeliveryAddressV1Confirmed(v1);
  }
}

export const catalogDeliveryAddressService = new CatalogDeliveryAddressService();
