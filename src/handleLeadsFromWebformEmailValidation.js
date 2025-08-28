import 'dotenv/config.js'
// @ts-ignore 
import ZeroBounceSDK from '@zerobounce/zero-bounce-sdk';
import {B24Hook} from '@bitrix24/b24jssdk';
import {getFirstEmailFromLeadContact} from './getFirstEmailFromLeadContact.js'
import { getEmailVerificationStatusFromDB, addVerifiedEmailToDB } from './database.js';

const B24 = B24Hook.fromWebhookUrl(process.env.BITRIX_WEBHOOK);
const zerobounce = new ZeroBounceSDK();
zerobounce.init(process.env.ZB_API_KEY);


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
        const email = await getFirstEmailFromLeadContact(leadId);
        
        if(!email || typeof email === "undefined"){
            res.status(400).json({
                message: `${new Date().toLocaleString()} : Bad reques. Missing email in Lead ${leadId}.`
            });
            console.error(`${new Date().toLocaleString()} : Bad reques. Missing email in Lead ${leadId}.`);
            return;
        }

//******************************* Check with the DB first */
        try{
            const result = await getEmailVerificationStatusFromDB(email);

            if(result){
                if(['valid', 'catch-all'].includes(result)){ 
                    await B24.callMethod(
                        'crm.lead.update',
                        {
                            id: leadId,
                            fields: {
                                UF_CRM_1752839236813 : "N", //Boolean custom field. If 'Y' lead has invalid email, if 'N' lead has valid email

                                UF_CRM_1754902962279 : "Y"  //Boolean custom field. If 'Y' - email was verified succesfully
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
                                COMMENT : `Emailul a fost verificat din DB și este valid.`
                            }
                        }
                    );

                    res.status(200).json({
                        message: `${new Date().toLocaleString()} : Emailul ${email} a fost validat din DB. -> VALID`
                    });
                    
                    return;

                } else{
                    await B24.callMethod(
                        'crm.lead.update',
                        {
                            id: leadId,
                            fields: {
                                UF_CRM_1752839236813 : "Y", //Boolean custom field. If 'Y' lead has invalid email, if 'N' lead has valid email
                                
                                UF_CRM_1754902962279 : "Y"  //Boolean custom field. If 'Y' - email was verified succesfully
                            
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
                                COMMENT : 
                                `Emailul a fost verificat din DB și este INVALID. Nu trimiteți emailuri către acest contact.`
                            }
                        }
                    );

                    res.status(200).json({
                        message: `${new Date().toLocaleString()} : Emailul ${email} a fost validat din DB. -> INVALID`
                    });
                    return;
                }
            }

        }catch(error){
            console.error(new Date().toLocaleString(), ': There is a DB error.', error.message);
            res.status(500).json({
                message: `${new Date().toLocaleString()} : There is a DB Error -> ${error.message}`
            });
            return;
        }
//******************************** Validate using ZeroBounce */
    const {status, sub_status, did_you_mean} = await zerobounce.validateEmail(email);

        try{            
            if(did_you_mean){

                await B24.callMethod(
                    'crm.timeline.comment.add',
                    {
                        fields: {
                            ENTITY_ID : leadId,
                            ENTITY_TYPE : 'lead',
                            AUTHOR_ID : process.env.DAD_BX_USER,
                            COMMENT : 
                            `Posibil este o eroare de sintaxă. \n
                            Probabil adresa corectă este: ${did_you_mean} \n
                            Necesită verificare manuală.`
                        }
                    }
                );
            }

            if(status === 'unknown'){
                await B24.callMethod(
                    'crm.lead.update',
                    {
                        id: leadId,
                        fields: {
                            UF_CRM_1752839236813 : "N", //Boolean custom field. If 'Y' lead has invalid email, if 'N' lead has valid email

                            UF_CRM_1754902962279 : "Y"  //Boolean custom field. If 'Y' - email was verified succesfully
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
                            COMMENT : 
                            `Emailul nu poate fi verificat de către ZeroBounce. Poate fi considerat valid, dacă pare a fi dintr-o sursă credibilă.\n
                            Substatus: ${sub_status}`
                        }
                    }
                );
            } 
            else if(['valid', 'catch-all'].includes(status)){ 
                await B24.callMethod(
                    'crm.lead.update',
                    {
                        id: leadId,
                        fields: {
                            UF_CRM_1752839236813 : "N", //Boolean custom field. If 'Y' lead has invalid email, if 'N' lead has valid email

                            UF_CRM_1754902962279 : "Y"  //Boolean custom field. If 'Y' - email was verified succesfully
                        },
                        params: {
                            REGISTER_SONET_EVENT: "Y"
                        }
                    }
                );
                console.log('sub_status:', sub_status, typeof sub_status);
                await B24.callMethod(
                    'crm.timeline.comment.add',
                    {
                        fields: {
                            ENTITY_ID : leadId,
                            ENTITY_TYPE : 'lead',
                            AUTHOR_ID : process.env.DAD_BX_USER,
                            COMMENT : `Emailul a fost verificat și este valid.`
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
                            UF_CRM_1752839236813 : "Y", //Boolean custom field. If 'Y' lead has invalid email, if 'N' lead has valid email
                            
                            UF_CRM_1754902962279 : "Y"  //Boolean custom field. If 'Y' - email was verified succesfully
                           
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
                            COMMENT : 
                            `Emailul a fost verificat și este INVALID. Nu trimiteți emailuri către acest contact.\n
                            Substatus: ${sub_status}`
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
            console.error(err);
            res.status(500).json({
                message: `${new Date().toLocaleString()} : There is a ZeroBounce Error -> ${err.message}`
            });
        }
        finally{
            await addVerifiedEmailToDB(email, status);
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