import express from 'express';
import NeverBounce from 'neverbounce';
import {B24Hook} from '@bitrix24/b24jssdk';
import 'dotenv/config.js';
import {getEmailFromLeadContact} from './getEmailFromLeadContact.js'

const B24 = B24Hook.fromWebhookUrl(process.env.BITRIX_WEBHOOK);
const NB_CLIENT = new NeverBounce({apiKey: process.env.NB_API_KEY});
const app = express();


app.use(express.json());

app.get('/', (req, res) => {
    res.status(200).json({
        message: "The server is live"
    });

    process.exit(0);
});

app.post('/webhook/lead-handler', async (req, res) => {
   
    await handleEmails(req, res);

    process.exit(0);
});

app.use((req, res) => {
    res.status(404).json({
        message: "Cannot find page"
    });
    process.exit(1);
});

const port = Number(process.env.PORT) || 3005;

app.listen(port, () => {
    console.log("Server is running on port", port);
});

const handleEmails = async (req, res) => {
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
        // 4        unknown     no
        try{
            if(emailVerificationResult.not([1,2,4])){ 
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

        console.error(`${new Date().toLocaleString()} : No handler found for your request. Or API Key doesn't match.`)
    }
}