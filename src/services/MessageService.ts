import mongoose from 'mongoose';

// Interfaces para o sistema de mensagens
export interface MessageRequest {
    phone: string;
    message: string;
    provider?: 'whatsapp' | 'twilio' | 'auto';
    source: 'discord' | 'api' | 'dashboard';
    userId?: string;
    metadata?: Record<string, any>;
}

export interface MessageResponse {
    success: boolean;
    messageId: string;
    provider: string;
    formattedPhone: string;
    timestamp: Date;
    error?: string;
}

export interface ProviderResponse {
    success: boolean;
    provider: string;
    messageId: string;
    error?: string;
}

export interface ProviderStatus {
    name: string;
    available: boolean;
    connected: boolean;
    lastCheck: Date;
    error?: string;
}

// Enum para tipos de erro
export enum MessageErrorType {
    INVALID_PHONE = 'INVALID_PHONE',
    PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
    RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
    AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
    MESSAGE_TOO_LONG = 'MESSAGE_TOO_LONG',
    PROVIDER_ERROR = 'PROVIDER_ERROR'
}

// Interface para resposta de erro
export interface ErrorResponse {
    success: false;
    error: {
        type: MessageErrorType;
        message: string;
        details?: any;
        retryAfter?: number;
    };
}

// Interface abstrata para provedores de mensagem
export interface MessageProvider {
    name: string;
    isAvailable(): Promise<boolean>;
    sendMessage(phone: string, message: string): Promise<ProviderResponse>;
    formatPhone(phone: string): string;
    validatePhone(phone: string): boolean;
}

// Schema para log de mensagens
const MessageLogSchema = new mongoose.Schema({
    messageId: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    formattedPhone: { type: String, required: true },
    message: { type: String, required: true },
    provider: { type: String, required: true },
    source: { type: String, required: true },
    userId: { type: String },
    status: { type: String, required: true, default: 'sent' },
    error: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed },
    timestamp: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now }
});

// Schema para rate limiting
const RateLimitSchema = new mongoose.Schema({
    identifier: { type: String, required: true },
    type: { type: String, required: true },
    requests: [{
        timestamp: { type: Date, default: Date.now }
    }],
    lastReset: { type: Date, default: Date.now }
});

// Modelos MongoDB
export const MessageLog = mongoose.model('MessageLog', MessageLogSchema);
export const RateLimit = mongoose.model('RateLimit', RateLimitSchema);

// Utilitários de formatação de telefone
export class PhoneUtils {
    static formatPhoneNumber(phone: string): string {
        // Remove todos os caracteres não numéricos
        let cleaned = phone.replace(/\D/g, '');
        
        // Adiciona código do país se não estiver presente (assumindo Brasil +55)
        if (!cleaned.startsWith('55') && cleaned.length === 11) {
            cleaned = '55' + cleaned;
        }
        
        return cleaned;
    }

    static formatForWhatsApp(phone: string): string {
        const formatted = this.formatPhoneNumber(phone);
        return formatted + '@s.whatsapp.net';
    }

    static formatForSMS(phone: string): string {
        const formatted = this.formatPhoneNumber(phone);
        return '+' + formatted;
    }

    static validatePhone(phone: string): boolean {
        const cleaned = phone.replace(/\D/g, '');
        // Valida se tem entre 10 e 15 dígitos (padrão internacional)
        return cleaned.length >= 10 && cleaned.length <= 15;
    }
}

// Classe principal do serviço de mensagens
export class MessageService {
    private providers: Map<string, MessageProvider> = new Map();
    private defaultProvider: string = 'whatsapp';

    constructor() {
        console.log('🔧 MessageService initialized');
    }

    // Registrar um provedor
    registerProvider(provider: MessageProvider): void {
        this.providers.set(provider.name, provider);
        console.log(`📡 Provider registered: ${provider.name}`);
    }

    // Obter status de todos os provedores
    async getProviderStatus(): Promise<ProviderStatus[]> {
        const statuses: ProviderStatus[] = [];
        
        for (const [name, provider] of this.providers) {
            try {
                const available = await provider.isAvailable();
                statuses.push({
                    name,
                    available,
                    connected: available,
                    lastCheck: new Date()
                });
            } catch (error) {
                statuses.push({
                    name,
                    available: false,
                    connected: false,
                    lastCheck: new Date(),
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        
        return statuses;
    }

    // Validar número de telefone
    validatePhoneNumber(phone: string): { valid: boolean; error?: string } {
        if (!phone || phone.trim().length === 0) {
            return { valid: false, error: 'Número de telefone é obrigatório' };
        }

        if (!PhoneUtils.validatePhone(phone)) {
            return { valid: false, error: 'Formato de número de telefone inválido' };
        }

        return { valid: true };
    }

    // Gerar ID único para mensagem
    private generateMessageId(): string {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Selecionar provedor baseado na preferência e disponibilidade
    private async selectProvider(preferredProvider?: string): Promise<MessageProvider | null> {
        // Se um provedor específico foi solicitado
        if (preferredProvider && preferredProvider !== 'auto') {
            const provider = this.providers.get(preferredProvider);
            if (provider && await provider.isAvailable()) {
                return provider;
            }
        }

        // Tentar provedor padrão
        const defaultProv = this.providers.get(this.defaultProvider);
        if (defaultProv && await defaultProv.isAvailable()) {
            return defaultProv;
        }

        // Tentar qualquer provedor disponível
        for (const provider of this.providers.values()) {
            if (await provider.isAvailable()) {
                return provider;
            }
        }

        return null;
    }

    // Enviar mensagem
    async sendMessage(request: MessageRequest): Promise<MessageResponse | ErrorResponse> {
        try {
            // Validar número de telefone
            const phoneValidation = this.validatePhoneNumber(request.phone);
            if (!phoneValidation.valid) {
                return {
                    success: false,
                    error: {
                        type: MessageErrorType.INVALID_PHONE,
                        message: phoneValidation.error || 'Número inválido'
                    }
                };
            }

            // Validar mensagem
            if (!request.message || request.message.trim().length === 0) {
                return {
                    success: false,
                    error: {
                        type: MessageErrorType.MESSAGE_TOO_LONG,
                        message: 'Mensagem é obrigatória'
                    }
                };
            }

            if (request.message.length > 1000) {
                return {
                    success: false,
                    error: {
                        type: MessageErrorType.MESSAGE_TOO_LONG,
                        message: 'Mensagem muito longa (máximo 1000 caracteres)'
                    }
                };
            }

            // Selecionar provedor
            const provider = await this.selectProvider(request.provider);
            if (!provider) {
                return {
                    success: false,
                    error: {
                        type: MessageErrorType.PROVIDER_UNAVAILABLE,
                        message: 'Nenhum provedor de mensagem disponível'
                    }
                };
            }

            // Gerar ID da mensagem
            const messageId = this.generateMessageId();
            const formattedPhone = provider.formatPhone(request.phone);

            // Enviar mensagem
            const result = await provider.sendMessage(request.phone, request.message);
            
            if (!result.success) {
                // Log da falha
                await this.logMessage({
                    messageId,
                    phone: request.phone,
                    formattedPhone,
                    message: request.message,
                    provider: provider.name,
                    source: request.source,
                    userId: request.userId,
                    status: 'failed',
                    error: result.error,
                    metadata: request.metadata
                });

                return {
                    success: false,
                    error: {
                        type: MessageErrorType.PROVIDER_ERROR,
                        message: result.error || 'Erro no provedor de mensagem'
                    }
                };
            }

            // Log do sucesso
            await this.logMessage({
                messageId,
                phone: request.phone,
                formattedPhone,
                message: request.message,
                provider: provider.name,
                source: request.source,
                userId: request.userId,
                status: 'sent',
                metadata: request.metadata
            });

            return {
                success: true,
                messageId,
                provider: provider.name,
                formattedPhone,
                timestamp: new Date()
            };

        } catch (error) {
            console.error('❌ Error in MessageService.sendMessage:', error);
            return {
                success: false,
                error: {
                    type: MessageErrorType.PROVIDER_ERROR,
                    message: 'Erro interno do sistema'
                }
            };
        }
    }

    // Log de mensagem no MongoDB
    private async logMessage(logData: any): Promise<void> {
        try {
            await MessageLog.create(logData);
            console.log(`📝 Message logged: ${logData.messageId}`);
        } catch (error) {
            console.error('❌ Failed to log message:', error);
        }
    }
}

// Instância singleton
export const messageService = new MessageService();