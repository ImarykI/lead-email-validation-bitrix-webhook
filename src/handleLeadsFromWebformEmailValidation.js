import NeverBounce from 'neverbounce';
import { ZeroBounceSDK } from '@ts-ignore@zerobounce/zero-bounce-sdk';
import {B24Hook} from '@bitrix24/b24jssdk';
import dotenv from 'dotenv';
import {getEmailFromLeadContact} from './getEmailFromLeadContact.js'

dotenv.config({path: "./env/local.env"});

const B24 = B24Hook.fromWebhookUrl(process.env.BITRIX_WEBHOOK);
const NB_CLIENT = new NeverBounce({apiKey: process.env.NB_API_KEY});
const zerobounce = new ZeroBounceSDK();
zerobounce.init(process.env.ZB_API_KEY);

const result = await zerobounce.validateEmail("invalid@example.com");

console.log(result);



const handleLeadsFromWebformEmailValidation = async (req, res) => {
    const apiKey = req.query.api_key;

    if(apiKey === process.env.WEBHOOK_API_KEY){
        const leadId = req.query.lead_id;
        
        if(!leadId || leadId === null || leadId === undefined || isNaN(parseInt(leadId,10))){
            res.status(400).json({
                message: `${new Date().toLocaleString()} : Bad request. Missing lead ID or leadID is not of valid type number. Attempted ID: ${leadId}`
            });
            
            console.error(`${new Date().toLocaleString()} : Bad request. Missing lead ID or leadID is not of valid type number. Attempted ID: ${leadId}`);
            return;
        }
        const email = await getEmailFromLeadContact(leadId);
        
        if(!email || typeof email === "undefined"){
            res.status(400).json({
                message: `${new Date().toLocaleString()} : Bad reques. Missing email in Lead ${leadId}.`
            });
            console.error(`${new Date().toLocaleString()} : Bad reques. Missing email in Lead ${leadId}.`);
            return;
        }

        const emailVerificationResult = await NB_CLIENT.single.check(email);
        
        // CODES    SEMANTIC    OK TO SEND?
        // 0        valid       yes
        // 1        invalid     no
        // 2        disposable  no
        // 3        catchall    maybe(yes in most cases won't generate error)
        // 4        unknown     no, but many custom domains and less popular ones are marked this way, so yes
        try{
            if(emailVerificationResult.not([1,2])){ 
                await B24.callMethod(
                    'crm.timeline.comment.add',
                    {
                        fields: {
                            ENTITY_ID : leadId,
                            ENTITY_TYPE : 'lead',
                            AUTHOR_ID : process.env.DAD_BX_USER,
                            COMMENT : "Emailul a fost verificat și este valid."
                        }
                    }
                );

                res.status(200).json({
                    message: `${new Date().toLocaleString()} : Emailul ${email} a fost validat. -> VALID`
                });
                return;
                
            } else {
                await B24.callMethod(
                    'crm.lead.update',
                    {
                        id: leadId,
                        fields: {
                        //Boolean custom field. If 'Y' lead has invalid email, if 'N' lead has valid email
                            UF_CRM_1752839236813 : "Y"                             
                        },
                        params: {
                            REGISTER_SONET_EVENT: "Y"
                        }
                    }
                );

                await B24.callMethod(
                    'crm.timeline.comment.add',
                    {
                        fields: {
                            ENTITY_ID : leadId,
                            ENTITY_TYPE : 'lead',
                            AUTHOR_ID : process.env.DAD_BX_USER,
                            COMMENT : "Emailul a fost verificat și este INVALID. Nu trimiteți emailuri către acest contact."
                        }
                    }
                );

                res.status(200).json({
                    message: `${new Date().toLocaleString()} : Emailul ${email} a fost validat. -> INVALID`
                });
                return;
            }
        }
        catch(err) {
            // Handle errors with type checking
            if (err instanceof Error) {
                switch(err.type) {
                    case NeverBounce.errors.AuthError:
                    console.error('Auth Error:', err.message);
                    break;
                    case NeverBounce.errors.BadReferrerError:
                    console.error('Bad Referrer Error:', err.message);
                    break;
                    case NeverBounce.errors.ThrottleError:
                    console.error('Throttle Error:', err.message);
                    break;
                    case NeverBounce.errors.GeneralError:
                    console.error('General Error:', err.message);
                    break;
                    default:
                    console.error('Error:', err.message);
                    break;   
                }
                res.status(500).json({
                    message: `${new Date().toLocaleString()} : There is a NB Error -> ${err.message}`
                });
            } 
            else {
                console.error('Unknown error:', err);

                res.status(500).json({
                    message: `${new Date().toLocaleString()} : There is an Unknown Error -> ${err.message}`
                });
            }
        }
    } 
    else {
        res.status(400).json({
            message : `${new Date().toLocaleString()} : No handler found for your request. Or API Key doesn't match.`
        });

        console.error(`${new Date().toLocaleString()} : No handler found for your request. Or API Key doesn't match.`);
    }
}

export {handleLeadsFromWebformEmailValidation}