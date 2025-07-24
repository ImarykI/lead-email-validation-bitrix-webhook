import { B24Hook } from "@bitrix24/b24jssdk";
import 'dotenv/config.js'

const YES = 'Y';

const B24 = B24Hook.fromWebhookUrl(process.env.BITRIX_WEBHOOK);

const getEmailFromLeadContact = async (leadId) => {
    
    const leadContactResult = await B24.callMethod(
        'crm.lead.contact.items.get',
        {
            id: leadId,
        }
    );

    const contactsFromResult = leadContactResult.getData().result;
    const primaryContact = contactsFromResult.find(contact => contact["IS_PRIMARY"] === YES);
    const contactId = primaryContact["CONTACT_ID"];

    const contactResult = await B24.callMethod(
        'crm.contact.get',
        {
            id: contactId,
        }
    );

    const data = contactResult.getData().result;

    if(data["HAS_EMAIL"] !== YES){
        return undefined;
    }

    const emails = data["EMAIL"];
    const firstEmail = emails[0];

    return firstEmail["VALUE"];
}

export {getEmailFromLeadContact}