"""Download regular-season Statcast pitch data from Baseball Savant, one day per request.
Usage: python3 fetch_statcast.py 2015 2026"""
import sys, os, io, time, datetime as dt, concurrent.futures as cf
import pandas as pd, urllib.request

OUT = os.environ.get('SC_OUT','/home/claude/war/sc')
KEEP = ['game_date','game_pk','at_bat_number','pitch_number','inning','inning_topbot','batter','pitcher',
        'events','description','stand','p_throws','home_team','away_team','type','hit_location','bb_type',
        'balls','strikes','outs_when_up','on_1b','on_2b','on_3b','hc_x','hc_y','launch_speed','launch_angle',
        'hit_distance_sc','fielder_2','fielder_3','fielder_4','fielder_5','fielder_6','fielder_7','fielder_8','fielder_9',
        'estimated_ba_using_speedangle','estimated_woba_using_speedangle','woba_value','woba_denom','babip_value',
        'iso_value','bat_score','post_bat_score','fld_score','post_fld_score','home_score','away_score',
        'post_home_score','post_away_score','delta_run_exp','delta_home_win_exp','plate_x','plate_z','sz_top','sz_bot',
        'zone','pitch_type','release_speed','if_fielding_alignment','of_fielding_alignment','des']
URL = ('https://baseballsavant.mlb.com/statcast_search/csv?all=true&hfGT=R%7C&hfSea={y}%7C&player_type=batter'
       '&game_date_gt={d}&game_date_lt={d}&type=details')

def one(y, d):
    f = f'{OUT}/{y}/{d}.parquet'
    if os.path.exists(f): return d, 'cached'
    for attempt in range(5):
        try:
            req = urllib.request.Request(URL.format(y=y, d=d), headers={'User-Agent': 'Mozilla/5.0'})
            raw = urllib.request.urlopen(req, timeout=170).read()
            df = pd.read_csv(io.BytesIO(raw), low_memory=False)
            df.columns = [c.lstrip('﻿') for c in df.columns]
            if len(df) >= 25000: return d, 'TRUNCATED'
            if len(df) == 0:
                open(f + '.empty', 'w').close(); return d, 'empty'
            df = df[[c for c in KEEP if c in df.columns]]
            tmp = f + '.tmp'; df.to_parquet(tmp, index=False); os.replace(tmp, f)
            return d, len(df)
        except Exception as e:
            err = e; time.sleep(5 * (attempt + 1))
    return d, f'FAIL {err}'

if __name__ == '__main__':
    y0, y1 = int(sys.argv[1]), int(sys.argv[2])
    jobs = []
    for y in range(y0, y1 + 1):
        os.makedirs(f'{OUT}/{y}', exist_ok=True)
        d = dt.date(y, 3, 15)
        while d <= dt.date(y, 10, 6):
            s = d.isoformat()
            if not os.path.exists(f'{OUT}/{y}/{s}.parquet.empty'): jobs.append((y, s))
            d += dt.timedelta(days=1)
    with cf.ThreadPoolExecutor(int(sys.argv[3]) if len(sys.argv)>3 else 3) as ex:
        for (y, s), fut in zip(jobs, [ex.submit(one, y, s) for y, s in jobs]):
            r = fut.result()
            if r[1] not in ('cached', 'empty'): print(y, r, flush=True)
    print('DONE', flush=True)
