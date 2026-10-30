# -*- coding: utf-8 -*-
import sys, os, xbmc, xbmcgui, xbmcaddon
sys.path.insert(0, os.path.join(xbmcaddon.Addon().getAddonInfo("path"), "resources", "lib"))
import outils
A = xbmcaddon.Addon()
mon = xbmc.Monitor()
if not A.getSetting("premier_lancement_fait") and not mon.waitForAbort(20):
    if xbmcgui.Dialog().yesno("Clipia", "Bienvenue ! Veux-tu installer maintenant les extensions légales (YouTube, Arte, replay, radios, podcasts…) et activer la commande vocale Clipia ?", yeslabel="Oui, installer", nolabel="Plus tard"):
        xbmc.executebuiltin("RunPlugin(plugin://plugin.video.clipia.home/?act=tout)")
        mon.waitForAbort(2)
        outils.activer_controle_distance()
    A.setSetting("premier_lancement_fait", "1")
