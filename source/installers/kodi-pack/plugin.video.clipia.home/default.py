# -*- coding: utf-8 -*-
import sys, os, urllib.parse as up
import xbmc, xbmcgui, xbmcplugin, xbmcaddon
sys.path.insert(0, os.path.join(xbmcaddon.Addon().getAddonInfo("path"), "resources", "lib"))
from cat import CATEGORIES, TOUT, M3U_FR
import outils

H = int(sys.argv[1]); BASE = sys.argv[0]
A = xbmcaddon.Addon(); CHEMIN = A.getAddonInfo("path")
def media(n): return os.path.join(CHEMIN, "resources", "media", n)
def url(**p): return BASE + "?" + up.urlencode(p)

def accueil():
    for c in CATEGORIES:
        it = xbmcgui.ListItem(label=c["titre"])
        it.setInfo("video", {"title": c["titre"], "plot": c["desc"]})
        img = media("cat_%s.jpg" % c["id"])
        it.setArt({"thumb": img, "icon": img, "fanart": img, "poster": img})
        xbmcplugin.addDirectoryItem(H, url(cat=c["id"]), it, True)
    xbmcplugin.setContent(H, "files"); xbmcplugin.endOfDirectory(H)

def categorie(cid):
    c = next(x for x in CATEGORIES if x["id"] == cid)
    if c.get("action") == "clipia": return menu_clipia()
    img = media("cat_%s.jpg" % cid)
    def ligne(label, u, dossier=True, plot=""):
        it = xbmcgui.ListItem(label=label); it.setArt({"thumb": img, "fanart": img}); it.setInfo("video", {"plot": plot})
        xbmcplugin.addDirectoryItem(H, u, it, dossier)
    if c.get("fenetre"):
        ligne("▶ Ouvrir : %s" % c["titre"], url(ouvre=cid), False, c["desc"])
    for aid, nom in c.get("addons", []):
        if outils.installe(aid): ligne("✔ %s (installé) — ouvrir" % nom, url(lance=aid), False)
        else: ligne("⬇ Installer %s" % nom, url(inst=aid), False, "Installe l'extension depuis le dépôt officiel Kodi.")
    xbmcplugin.endOfDirectory(H)

def menu_clipia():
    img = media("cat_clipia.jpg")
    def ligne(label, u, plot=""):
        it = xbmcgui.ListItem(label=label); it.setArt({"thumb": img, "fanart": img}); it.setInfo("video", {"plot": plot})
        xbmcplugin.addDirectoryItem(H, u, it, False)
    ligne("⬇ Tout installer (extensions légales)", url(act="tout"), "Installe YouTube, Arte, replay, radios, podcasts, Jellyfin, etc.")
    ligne("📺 Configurer la TV en direct (chaînes gratuites)", url(act="tv"), "Charge une liste de chaînes gratuites et légales. Redémarre Kodi ensuite.")
    ligne("🎙 Activer la commande vocale Clipia", url(act="voix"), "Active le contrôle à distance (port 8080).")
    ligne("ℹ Adresse de Kodi pour Clipia", url(act="ip"))
    xbmcplugin.endOfDirectory(H)

def agir(a):
    d = xbmcgui.Dialog()
    if a == "tout":
        ok, manque = outils.installer(TOUT)
        txt = "Installées : %d.\n" % len(ok)
        if manque: txt += "Non installées (indisponibles dans ton dépôt ou refus) : " + ", ".join(manque)
        d.ok("Clipia", txt)
    elif a == "tv":
        if not outils.installe("pvr.iptvsimple"): outils.installer(["pvr.iptvsimple"])
        outils.regler_tv(M3U_FR)
        d.ok("Clipia", "Liste de chaînes configurée. Redémarre Kodi, puis ouvre « TV en direct ». Si rien n'apparaît : Extensions → Mes extensions → Clients PVR → PVR IPTV Simple → Configurer.")
    elif a == "voix":
        ok = outils.activer_controle_distance()
        d.ok("Clipia", ("Contrôle à distance activé. " if ok else "Active-le à la main : Réglages → Services → Contrôle. ") +
             "Dans Clipia → Réglages → Kodi, saisis : http://%s:8080 (ou http://localhost:8080 si Clipia est sur le même appareil)." % outils.ip_locale())
    elif a == "ip":
        d.ok("Clipia", "Adresse de Kodi : http://%s:8080" % outils.ip_locale())

def ouvre(cid):
    c = next(x for x in CATEGORIES if x["id"] == cid)
    if c.get("ouvre"): xbmc.executebuiltin("ActivateWindow(%s,%s,return)" % (c["fenetre"], c["ouvre"]))
    else: xbmc.executebuiltin("ActivateWindow(%s)" % c["fenetre"])

p = dict(up.parse_qsl(sys.argv[2][1:])) if len(sys.argv) > 2 else {}
if "cat" in p: categorie(p["cat"])
elif "ouvre" in p: ouvre(p["ouvre"])
elif "lance" in p: xbmc.executebuiltin("RunAddon(%s)" % p["lance"])
elif "inst" in p:
    outils.installer([p["inst"]]); xbmc.executebuiltin("Container.Refresh")
elif "act" in p: agir(p["act"])
else: accueil()
