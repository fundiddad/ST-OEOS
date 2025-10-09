// @ts-nocheck
'use strict';

function renderChatToString(chatArray, context) {
    if (!Array.isArray(chatArray)) {
        // Since this is a module, we throw an error instead of using a global toastr.
        throw new Error('renderChatToString: input must be an array.');
    }

    // This function relies on 'messageFormatting' which is a global in SillyTavern.
    // It's an implicit dependency.
    if (typeof context.messageFormatting !== 'function') {
        throw new Error('renderChatToString: global function "messageFormatting" is not defined on context.');
    }

    const tempDiv = document.createElement('div');
    const plainTextMessages = [];

    for (const mes of chatArray) {
        const options = {
            is_system: mes.is_system,
            is_user: mes.is_user,
            swipe_id: mes.swipe_id,
            id: mes.id,
        };
        const htmlString = context.messageFormatting(mes.mes, mes.name, options);

        // Strip HTML tags by rendering to a temporary element
        tempDiv.innerHTML = htmlString;
        plainTextMessages.push(tempDiv.textContent || '');
    }

    return plainTextMessages.join('\n');
}

export { renderChatToString };
