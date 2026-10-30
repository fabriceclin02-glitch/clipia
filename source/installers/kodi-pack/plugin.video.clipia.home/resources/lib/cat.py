# -*- coding: utf-8 -*-
"""Catégories de l'accueil Clipia. 'ouvre' = chemin Kodi à ouvrir ; 'addons' = extensions officielles proposées (installées depuis le dépôt Kodi)."""
CATEGORIES = [
    {"id": "films", "titre": "Films", "desc": "Ta bibliothèque de films", "ouvre": "videodb://movies/titles/", "fenetre": "videos", "addons": [("plugin.video.jellyfin", "Jellyfin"), ("plugin.video.plexkodiconnect", "Plex")]},
    {"id": "series", "titre": "Séries", "desc": "Ta bibliothèque de séries", "ouvre": "videodb://tvshows/titles/", "fenetre": "videos", "addons": [("plugin.video.jellyfin", "Jellyfin"), ("plugin.video.plexkodiconnect", "Plex")]},
    {"id": "tv", "titre": "TV en direct", "desc": "Chaînes gratuites et légales (PVR IPTV Simple)", "fenetre": "tvchannels", "addons": [("pvr.iptvsimple", "PVR IPTV Simple")]},
    {"id": "replay", "titre": "Replay TV", "desc": "Arte, France TV et autres chaînes en rattrapage", "addons": [("plugin.video.arteplussept", "Arte"), ("plugin.video.catchuptvandmore", "Catch-up TV & More")]},
    {"id": "youtube", "titre": "YouTube", "desc": "Vidéos et musique YouTube", "addons": [("plugin.video.youtube", "YouTube")]},
    {"id": "musique", "titre": "Musique", "desc": "Ta musique et des services en ligne", "ouvre": "musicdb://", "fenetre": "music", "addons": [("plugin.audio.soundcloud", "SoundCloud"), ("plugin.audio.mixcloud", "Mixcloud")]},
    {"id": "radio", "titre": "Radio", "desc": "Des milliers de radios du monde", "fenetre": "radiochannels", "addons": [("plugin.audio.radio_de", "Radio (radio.de)")]},
    {"id": "docs", "titre": "Documentaires et culture", "desc": "Conférences, espace, archives libres", "addons": [("plugin.video.ted.talks", "TED"), ("plugin.video.internetarchive", "Internet Archive"), ("plugin.video.nasa", "NASA")]},
    {"id": "podcasts", "titre": "Podcasts", "desc": "Tes émissions préférées", "addons": [("plugin.audio.podcasts", "Podcasts")]},
    {"id": "clipia", "titre": "Clipia et réglages", "desc": "Commande vocale, adresse de Kodi, installation", "action": "clipia"},
]
# Extensions installées par « Tout installer » (toutes officielles ou de projets ouverts et légaux)
TOUT = ["inputstream.adaptive", "inputstream.ffmpegdirect", "pvr.iptvsimple", "plugin.video.youtube", "plugin.video.arteplussept", "plugin.video.catchuptvandmore",
        "plugin.audio.radio_de", "plugin.audio.podcasts", "plugin.video.ted.talks", "plugin.video.internetarchive", "plugin.video.nasa",
        "plugin.audio.soundcloud", "plugin.audio.mixcloud", "plugin.video.jellyfin"]
# Liste de chaînes gratuites et légales (projet iptv-org, chaînes de France)
M3U_FR = "https://iptv-org.github.io/iptv/countries/fr.m3u"
