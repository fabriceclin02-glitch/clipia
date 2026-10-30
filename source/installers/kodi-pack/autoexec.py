# Clipia : active le pack Clipia au premier démarrage de Kodi, puis se supprime.
import json, xbmc, xbmcvfs
xbmc.sleep(6000)
for a in ("repository.clipia", "plugin.video.clipia.home"):
    xbmc.executeJSONRPC(json.dumps({"jsonrpc": "2.0", "id": 1, "method": "Addons.SetAddonEnabled", "params": {"addonid": a, "enabled": True}}))
xbmc.executebuiltin('Notification(Clipia,Pack Clipia activé : Extensions → Extensions vidéo → Clipia — Accueil,8000)')
xbmcvfs.delete("special://profile/autoexec.py")
