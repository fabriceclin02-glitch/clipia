import sys, json, os
from playwright.sync_api import sync_playwright
v,part,parts=sys.argv[1],int(sys.argv[2]),int(sys.argv[3])
T=json.load(open(f'/home/claude/lab/x8/TL_{v}.json')); FPS=30; N=int(T['end']*FPS)
D=f'/tmp/x8f_{v}'; os.makedirs(D,exist_ok=True)
todo=[i for i in range(N) if not os.path.exists(f'{D}/f{i:05d}.jpg') or os.path.getsize(f'{D}/f{i:05d}.jpg')<2000][part::parts]
def go():
    with sync_playwright() as p:
        b=p.chromium.launch(args=['--allow-file-access-from-files','--disable-dev-shm-usage']); pg=b.new_page(viewport={'width':1280,'height':720})
        pg.goto(f'file:///home/claude/lab/x8/demo_{v}.html'); pg.wait_for_timeout(500)
        while todo:
            i=todo[0]; pg.evaluate(f'render({i/FPS})'); pg.screenshot(path=f'{D}/f{i:05d}.jpg',type='jpeg',quality=88); todo.pop(0)
        b.close()
for _ in range(6):
    try: go(); break
    except Exception as e: print('reprise',len(todo))
