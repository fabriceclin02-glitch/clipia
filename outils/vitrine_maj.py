#!/usr/bin/env python3
"""Met à jour vitrine.json (page d'accueil de Clipia Nova).
- YouTube : les vidéos les plus regardées en France (API YouTube Data v3, secret YOUTUBE_API_KEY).
- TikTok : complète l'image des vidéos TikTok listées à la main (oEmbed public de TikTok).
Les produits et vidéos ajoutés à la main ne sont jamais modifiés."""
import json, os, sys, urllib.request, urllib.parse, datetime

F = os.path.join(os.path.dirname(__file__), '..', 'vitrine.json')
def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Clipia-Nova-Vitrine'})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read().decode('utf-8'))

d = json.load(open(F, encoding='utf-8'))
avant = json.dumps(d, sort_keys=True)

key = os.environ.get('YOUTUBE_API_KEY', '').strip()
if key:
    try:
        q = urllib.parse.urlencode({'part': 'snippet,statistics', 'chart': 'mostPopular', 'regionCode': 'FR', 'maxResults': 12, 'key': key})
        items = get('https://www.googleapis.com/youtube/v3/videos?' + q).get('items', [])
        d['videos_auto'] = [{
            'titre': v['snippet']['title'][:120],
            'plateforme': 'youtube',
            'url': 'https://www.youtube.com/watch?v=' + v['id'],
            'image': (v['snippet']['thumbnails'].get('high') or v['snippet']['thumbnails']['default'])['url'],
            'auteur': v['snippet'].get('channelTitle', ''),
            'vues': int(v.get('statistics', {}).get('viewCount', 0)),
        } for v in items]
        print(f'YouTube : {len(items)} vidéos tendances')
    except Exception as e:
        print('YouTube indisponible :', e, file=sys.stderr)
else:
    print('Pas de clé YOUTUBE_API_KEY : tendances YouTube non mises à jour')

for v in d.get('videos', []):
    if v.get('plateforme') == 'tiktok' and '/video/' in v.get('url', '') and not v.get('image'):
        try:
            o = get('https://www.tiktok.com/oembed?url=' + urllib.parse.quote(v['url'], safe=''))
            v['image'] = o.get('thumbnail_url', ''); v.setdefault('titre', o.get('title', '')[:120]); v.setdefault('auteur', o.get('author_name', ''))
        except Exception as e:
            print('TikTok indisponible pour', v['url'], ':', e, file=sys.stderr)

if json.dumps(d, sort_keys=True) != avant:
    d['maj'] = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    json.dump(d, open(F, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    print('vitrine.json mis à jour')
else:
    print('Rien de nouveau')
