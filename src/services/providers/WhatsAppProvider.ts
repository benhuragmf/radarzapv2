import { MessageProvider, ProviderResponse, PhoneUtils } from '../MessageService';
import { WASocket } from '@whiskeysockets/baileys';

export class WhatsAppProvider implements MessageProvider {
    name = 'whatsapp';
    private socket: WASocket | null = null;
    private ready: boolean = false;

    constructor(socket: WASocket | null, ready: boolean) {
        this.socket = socket;
        this.ready = ready;
        console.log(`📱 WhatsAppProvider initialized - Ready: ${ready}`);
    }

    // Atualizar referências do socket e status
    updateConnection(socket: WASocket | null, ready: boolean): void {
        this.socket = socket;
        this.ready = ready;
        console.log(`📱 WhatsApp connection updated - Ready: ${ready}`);
    }

    async isAvailable(): Promise<boolean> {
        return this.ready && this.socket !== null;
    }

    formatPhone(phone: string): string {
        return PhoneUtils.formatForWhatsApp(phone);
    }

    validatePhone(phone: string): boolean {
        return PhoneUtils.validatePhone(phone);
    }

    async sendMessage(phone: string, message: string): Promise<ProviderResponse> {
        try {
            if (!this.socket || !this.ready) {
                return {
                    success: false,
                    provider: this.name,
                    messageId: '',
                    error: 'WhatsApp não está conectado'
                };
            }

            const formattedPhone = this.formatPhone(phone);
            console.log(`📤 Sending WhatsApp message to: ${formattedPhone}`);

            // Enviar mensagem via WhatsApp
            const result = await this.socket.sendMessage(formattedPhone, {
                text: message
            });

            const messageId = result?.key?.id || `wa_${Date.now()}`;

            console.log(`✅ WhatsApp message sent successfully: ${messageId}`);

            return {
                success: true,
                provider: this.name,
                messageId,
            };

        } catch (error) {
            console.error('❌ WhatsApp send error:', error);
            
            return {
                success: false,
                provider: this.name,
                messageId: '',
                error: error instanceof Error ? error.message : 'Erro desconhecido no WhatsApp'
            };
        }
    }

    // Método para verificar se um número existe no WhatsApp
    async checkNumberExists(phone: string): Promise<boolean> {
        try {
            if (!this.socket || !this.ready) {
                return false;
            }

            const formattedPhone = this.formatPhone(phone);
            const [result] = await this.socket.onWhatsApp(formattedPhone);
            
            return (result as any)?.exists || false;
        } catch (error) {
            console.error('❌ Error checking WhatsApp number:', error);
            return false;
        }
    }

    // Obter informações do usuário conectado
    getUserInfo(): any {
        if (!this.socket || !this.ready) {
            return null;
        }

        return {
            id: this.socket.user?.id,
            name: this.socket.user?.name,
            verified: this.socket.user?.verifiedName
        };
    }

    // Obter status detalhado da conexão
    getConnectionStatus(): any {
        return {
            connected: this.ready,
            hasSocket: this.socket !== null,
            userInfo: this.getUserInfo(),
            timestamp: new Date().toISOString()
        };
    }
}