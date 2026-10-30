# -*- coding: utf-8 -*-
import os, json, xbmc, xbmcgui, xbmcvfs, xbmcaddon

A = xbmcaddon.Addon()
def t(s): return s

def installe(aid):
    return xbmc.getCondVisibility("System.HasAddon(%s)" % aid)

def installer(ids):
    """Installe les extensions depuis le dépôt Kodi, une par une. Retourne (ok, manquantes)."""
    manque = []
    dlg = xbmcgui.DialogProgress(); dlg.create("Clipia", "Installation des extensions…")
    n = len(ids)
    for i, aid in enumerate(ids):
        if dlg.iscanceled(): break
        dlg.update(int(100 * i / max(1, n)), "Installation : %s" % aid)
        if not installe(aid):
            xbmc.executebuiltin("InstallAddon(%s)" % aid, True)
            for _ in range(60):  # attend jusqu'à ~60 s
                if installe(aid) or dlg.iscanceled(): break
                xbmc.sleep(1000)
        if not installe(aid): manque.append(aid)
    dlg.close()
    return [a for a in ids if a not in manque], manque

def rpc(methode, params=None):
    try:
        r = xbmc.executeJSONRPC(json.dumps({"jsonrpc": "2.0", "id": 1, "method": methode, "params": params or {}}))
        return json.loads(r)
    except Exception:
        return {}

def activer_controle_distance():
    """Active le contrôle HTTP (port 8080) pour que Clipia puisse piloter Kodi."""
    ok = True
    for k, v in (("services.webserver", True), ("services.webserverport", 8080)):
        r = rpc("Settings.SetSettingValue", {"setting": k, "value": v})
        ok = ok and "error" not in r
    return ok

def ip_locale():
    return xbmc.getIPAddress() or "adresse inconnue"

def regler_tv(m3u):
    """Écrit la config de PVR IPTV Simple (instance 1) avec la liste de chaînes. Nécessite un redémarrage de Kodi."""
    dossier = xbmcvfs.translatePath("special://profile/addon_data/pvr.iptvsimple/")
    if not xbmcvfs.exists(dossier): xbmcvfs.mkdirs(dossier)
    xml = ('<settings version="2">\n<setting id="kodi_addon_instance_name">Clipia — chaînes gratuites</setting>\n'
           '<setting id="kodi_addon_instance_enabled">true</setting>\n<setting id="m3uPathType">1</setting>\n'
           '<setting id="m3uUrl">%s</setting>\n<setting id="startNum">1</setting>\n</settings>\n') % m3u
    f = xbmcvfs.File(dossier + "instance-settings-1.xml", "w"); f.write(xml); f.close()
