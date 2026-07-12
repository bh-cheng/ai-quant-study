import json
from pathlib import Path
import pandas as pd

ROOT=Path(__file__).resolve().parents[1]
RAW=ROOT/'data/raw/tushare_mcp/20260712'
OUT=ROOT/'data/processed/equities/daily/ml_equities_daily_20180101_20260712.csv'
REPORT=ROOT/'data/reports/ml_equities_daily_20180101_20260712.metadata.json'

daily=pd.read_json(RAW/'smic_a_daily_20180101_20260712.json')
adj=pd.read_json(RAW/'smic_a_adj_20180101_20260712.json')
daily['trade_date']=daily['trade_date'].astype(str)
adj['trade_date']=adj['trade_date'].astype(str)
df=daily.merge(adj[['ts_code','trade_date','adj_factor']],on=['ts_code','trade_date'],how='left')
latest=df.sort_values('trade_date')['adj_factor'].dropna().iloc[-1]
for c in ['open','high','low','close','pre_close']:
    df[f'qfq_{c}']=df[c]*df['adj_factor']/latest
df['qfq_change']=df.qfq_close-df.qfq_pre_close
df['qfq_pct_chg']=df.qfq_change/df.qfq_pre_close*100
df['instrument_key']='smic_a'; df['company_key']='smic'; df['market']='A-share'
df['exchange']='SSE'; df['currency']='CNY'
cols=['instrument_key','company_key','market','exchange','currency','ts_code','trade_date',
      'open','high','low','close','pre_close','change','pct_chg','vol','amount','adj_factor',
      'qfq_open','qfq_high','qfq_low','qfq_close','qfq_pre_close','qfq_change','qfq_pct_chg']
df=df[cols].sort_values('trade_date').reset_index(drop=True)
hk_files=[ROOT/'data/processed/equities/daily/smic_h_00981_HK_daily_20180101_20260712.csv',
          ROOT/'data/processed/equities/daily/byd_h_01211_HK_daily_20180101_20260712.csv']
frames=[df]+[pd.read_csv(f,dtype={'trade_date':str})[cols] for f in hk_files if f.exists()]
df=pd.concat(frames,ignore_index=True).sort_values(['ts_code','trade_date']).reset_index(drop=True)
assert not df[['qfq_open','qfq_high','qfq_low','qfq_close','adj_factor']].isna().any().any()
assert not df.duplicated(['ts_code','trade_date']).any()
assert ((df.qfq_high>=df[['qfq_open','qfq_close','qfq_low']].max(axis=1)) &
        (df.qfq_low<=df[['qfq_open','qfq_close','qfq_high']].min(axis=1))).all()
OUT.parent.mkdir(parents=True,exist_ok=True); df.to_csv(OUT,index=False,encoding='utf-8-sig')
meta={'run_date':'2026-07-12','source':'mixed','providers':['tushareMcp','yahoo'],
      'interfaces':['tushareMcp.daily','tushareMcp.adj_factor','yahoo_chart'],
      'requested_start':'20180101','requested_end':'20260712','price_basis':'qfq',
      'instruments_written':sorted(df.ts_code.unique().tolist()),'rows':len(df),'actual_start':df.trade_date.min(),
      'actual_end':df.trade_date.max(),'validation_status':'passed',
      'limitations':['688981.SH listed after 2018, so its history begins at listing',
                     '002594.SZ and 600900.SH await Tushare adjustment-factor quota; HK data uses Yahoo adjusted-close fallback']}
REPORT.parent.mkdir(parents=True,exist_ok=True); REPORT.write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
print(OUT, len(df), df.trade_date.min(), df.trade_date.max())
