import { MessageProvider, ProviderResponse, PhoneUtils } from '../MessageService';

export class TwilioProvider implements MessageProvider {
    name = 'twilio';
    private accountSid: string;
    private authToken: string;
    private fromPhone: string;
    private twilioClient: any = null;

    constructor() {
        this.accountSid = process.env.TWILIO_SID || '';
        this.authToken = process.env.TWILIO_TOKEN || '';
        this.fromPhone = process.env.TWILIO_PHONE || '';
        
        console.log(`📱 TwilioProvider initialized - Configured: ${this.isConfigured()}`);
        
        if (this.isConfigured()) {
            this.initializeTwilioClient();
        }
    }

    private isConfigured(): boolean {
        return !!(this.accountSid && this.authToken && this.fromPhone);
    }

    private async initializeTwilioClient(): Promise<void> {
        try {
            // Importação dinâmica do Twilio para evitar erro se não estiver instalado
            const twilio = await import('twilio');
            this.twilioClient = twilio.default(this.accountSid, this.authToken);
            console.log('📱 Twilio client initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize Twilio client:', error);
            console.log('💡 Install Twilio SDK: npm install twilio');
            this.twilioClient = null;
        }
    }

    async isAvailable(): Promise<boolean> {
        if (!this.isConfigured()) {
            return false;
        }

        if (!this.twilioClient) {
            await this.initializeTwilioClient();
        }

        return this.twilioClient !== null;
    }

    formatPhone(phone: string): string {
        return PhoneUtils.formatForSMS(phone);
    }

    validatePhone(phone: string): boolean {
        return PhoneUtils.validatePhone(phone);
    }

    async sendMessage(phone: string, message: string): Promise<ProviderResponse> {
        try {
            if (!await this.isAvailable()) {
                return {
                    success: false,
                    provider: this.name,
                    messageId: '',
                    error: 'Twilio não está configurado ou disponível'
                };
            }

            const formattedPhone = this.formatPhone(phone);
            console.log(`📤 Sending Twilio SMS to: ${formattedPhone}`);

            // Enviar SMS via Twilio
            const result = await this.twilioClient.messages.create({
                body: message,
                from: this.fromPhone,
                to: formattedPhone
            });

            console.log(`✅ Twilio SMS sent successfully: ${result.sid}`);

            return {
                success: true,
                provider: this.name,
                messageId: result.sid,
            };

        } catch (error) {
            console.error('❌ Twilio send error:', error);
            
            let errorMessage = 'Erro desconhecido no Twilio';
            
            if (error instanceof Error) {
                errorMessage = error.message;
                
                // Tratar erros específicos do Twilio
                if (error.message.includes('not a valid phone number')) {
                    errorMessage = 'Número de telefone inválido para SMS';
                } else if (error.message.includes('insufficient funds')) {
                    errorMessage = 'Saldo insuficiente na conta Twilio';
                } else if (error.message.includes('unverified')) {
                    errorMessage = 'Número não verificado na conta Twilio trial';
                }
            }
            
            return {
                success: false,
                provider: this.name,
                messageId: '',
                error: errorMessage
            };
        }
    }

    // Obter informações da conta Twilio
    async getAccountInfo(): Promise<any> {
        try {
            if (!await this.isAvailable()) {
                return null;
            }

            const account = await this.twilioClient.api.accounts(this.accountSid).fetch();
            
            return {
                sid: account.sid,
                friendlyName: account.friendlyName,
                status: account.status,
                type: account.type
            };
        } catch (error) {
            console.error('❌ Error getting Twilio account info:', error);
            return null;
        }
    }

    // Verificar saldo da conta (para contas pagas)
    async getBalance(): Promise<any> {
        try {
            if (!await this.isAvailable()) {
                return null;
            }

            const balance = await this.twilioClient.balance.fetch();
            
            return {
                balance: balance.balance,
                currency: balance.currency
            };
        } catch (error) {
            console.error('❌ Error getting Twilio balance:', error);
            return null;
        }
    }

    // Obter status detalhado do provedor
    getProviderStatus(): any {
        return {
            configured: this.isConfigured(),
            available: this.twilioClient !== null,
            accountSid: this.accountSid ? `${this.accountSid.substring(0, 8)}...` : 'Not set',
            fromPhone: this.fromPhone || 'Not set',
            timestamp: new Date().toISOString()
        };
    }
}