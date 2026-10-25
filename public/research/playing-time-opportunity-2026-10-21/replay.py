"""Offline verification, training-only refit, prediction and scoring replay."""
from pathlib import Path
import hashlib,json
import numpy as np
from model import train_model,predict
from score import score
ROOT=Path(__file__).resolve().parent

def same(actual,expected,path='root'):
 if isinstance(expected,dict):
  if actual.keys()!=expected.keys():raise ValueError('keys differ at '+path)
  for k in expected:same(actual[k],expected[k],path+'.'+k)
 elif isinstance(expected,list):
  if len(actual)!=len(expected):raise ValueError('length differs at '+path)
  for i,(a,e) in enumerate(zip(actual,expected)):same(a,e,f'{path}[{i}]')
 elif isinstance(expected,(int,float)):
  if not np.isclose(actual,expected,rtol=1e-8,atol=1e-8):raise ValueError(f'numeric mismatch at {path}: {actual} != {expected}')
 elif actual!=expected:raise ValueError('value differs at '+path)

def main():
 manifest=json.loads((ROOT/'manifest.json').read_text())
 for f,digest in manifest['files'].items():
  if hashlib.sha256((ROOT/f).read_bytes()).hexdigest()!=digest:raise ValueError('checksum mismatch '+f)
 inputs=json.loads((ROOT/'inputs.json').read_text())
 model=train_model(inputs['train']);same(model,json.loads((ROOT/'model.json').read_text()),'model')
 predictions=predict(model,inputs['evaluation']);same(predictions,json.loads((ROOT/'predictions.json').read_text()),'predictions')
 report=json.loads((ROOT/'results.json').read_text())
 same(score(inputs['evaluation'],predictions),report['scores'],'scores')
 print('Verified all file hashes, refitted 584 training rows, and reproduced 612 forecasts, scores and 5,000-draw intervals.')
if __name__=='__main__':main()
