package com.clendax.clipia;

import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.service.voice.VoiceInteractionSession;

/** Appel de l'assistante (bouton lateral, geste, « Ok Clipia » selon le telephone) : ouvre Clipia en ecoute. */
public class AssistSession extends VoiceInteractionSession {
    public AssistSession(Context contexte) {
        super(contexte);
    }

    @Override
    public void onShow(Bundle args, int flags) {
        super.onShow(args, flags);
        Intent i = new Intent(getContext(), MainActivity.class);
        i.setAction("com.clendax.clipia.ASSIST");
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        startAssistantActivity(i);
        hide();
    }
}
