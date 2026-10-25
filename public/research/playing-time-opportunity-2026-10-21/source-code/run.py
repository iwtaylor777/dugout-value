"""Fit the frozen 2024 specification, then score the fixed 2025 cohort."""
from pathlib import Path
import json
from normalize import normalize
from model import train_model,predict
from score import score
ROOT=Path(__file__).resolve().parent

def main():
 inputs,audits=normalize()
 model=train_model(inputs['train'])
 predictions=predict(model,inputs['evaluation'])
 results=dict(status='retrospective development; June 2024 fit, June 2025 evaluation',
  date='2026-10-21',audits=audits,scores=score(inputs['evaluation'],predictions))
 for name,obj in [('model.json',model),('predictions.json',predictions),('results.json',results)]:
  (ROOT/'results'/name).write_text(json.dumps(obj,indent=2,allow_nan=False)+'\n')
 print(ROOT/'results/results.json')
if __name__=='__main__':main()
