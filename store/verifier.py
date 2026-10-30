#!/usr/bin/env python3
"""Controle les catalogues du Store et du Depot IA."""
import json, re, sys
err = []
c = json.load(open('store/catalogue.json', encoding='utf-8'))
ids = set()
for a in c['apps']:
    for k in ('id', 'nom', 'desc', 'cat', 'type', 'url' if a.get('type') != 'clipia' else 'id'):
        if not a.get(k): err.append(f"{a.get('id')}: champ « {k} » manquant")
    if a['id'] in ids: err.append(f"id en double : {a['id']}")
    ids.add(a['id'])
    if a.get('cat') not in c['categories']: err.append(f"{a['id']}: catégorie inconnue « {a.get('cat')} »")
    t = a.get('type')
    if t not in ('apk', 'fdroid', 'web', 'clipia'): err.append(f"{a['id']}: type invalide")
    if t in ('apk', 'fdroid', 'web') and not str(a.get('url', '')).startswith('https://'): err.append(f"{a['id']}: l'URL doit être en https")
    if t == 'apk':
        if not re.fullmatch(r'[0-9a-fA-F]{64}', a.get('sha256', '')): err.append(f"{a['id']}: sha256 (64 caractères hexadécimaux) obligatoire pour un APK")
        if not a.get('pkg'): err.append(f"{a['id']}: pkg obligatoire pour un APK")
d = json.load(open('depot-ia/catalogue.json', encoding='utf-8'))
for g in d['agents']:
    for k in ('id', 'nom', 'role', 'instructions', 'outils'):
        if not g.get(k): err.append(f"agent {g.get('id')}: champ « {k} » manquant")
print(len(c['apps']), 'applications,', len(d['agents']), 'agents')
if err:
    print('\n'.join(err)); sys.exit(1)
print('OK')
