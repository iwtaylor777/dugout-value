"""Write app/data/dv-detail-2027.json for the projections page: 2027 rate stats plus baserunning and fielding components.
Keyed by site player id; only players with a Dugout Value projection."""
import json, sys
sys.path.insert(0, '/home/claude/pw/comp')
import fielding as fl
REPO = '/home/claude/dugout-value'
db = json.load(open(f'{REPO}/app/data/player-database.json')); dv = json.load(open(f'{REPO}/app/data/dv-projections.json'))['players']
det = json.load(open('/home/claude/pw/comp/detail_2027.json')); comp = json.load(open('/home/claude/pw/comp/components_2027.json'))['players']
F, _ = fl.load()
out = {}
for p in db['players']:
    if p.get('kind') != 'mlb' or p['id'] not in dv: continue
    fg = str(p.get('fangraphsId') or ''); e = {}
    if p['role'] in ('position', 'two-way') and fg in det['bat']:
        b = det['bat'][fg]
        e.update(avg=round(b['AVG'], 3), obp=round(b['OBP'], 3), slg=round(b['SLG'], 3), wrc=round(b['wRC+']))
        c = comp.get(fg)
        if c:
            e['bsr'] = c['bsr']
            inn, _ = fl.evidence(F.get(fg, {}), 2027)
            if c['fr'] and inn:
                fpos = max(inn, key=inn.get)
                if fpos in c['fr']: e['fpos'] = fpos; e['fld'] = c['fr'][fpos]
    if p['role'] in ('starter', 'reliever', 'two-way') and fg in det['pit']:
        q = det['pit'][fg]
        e.update(era=round(q['ERA'], 2), fip=round(q['FIP'], 2), k=round(q['K%'] * 100, 1), bb=round(q['BB%'] * 100, 1))
    if e: out[p['id']] = e
json.dump(dict(meta=dict(season=2027, built='2026-10-31', note='Dugout Value 2027 rate projections. Fielding: runs per full season at the position he has played most in 2024-26. Baserunning: runs per 600 PA.'), players=out),
          open(f'{REPO}/app/data/dv-detail-2027.json', 'w'), separators=(',', ':'))
print(len(out), out.get('mlb-678554'))
