"""Fixed baseline formulas; input periods contain only pre-forecast information."""


def rate_baselines(current, prior, league):
    if len(prior)!=3 or any(len(period)!=3 or min(period)<0 or period[1]+period[2]>period[0]
                            for period in [current,*prior]):
        raise ValueError("invalid historical event counts")
    weighted=[sum(weight*period[i] for weight,period in zip([1,.8,.6,.4],[current,*prior])) for i in range(3)]
    numerators={"K%":weighted[1],"BB%":weighted[2],"K-BB%":weighted[1]-weighted[2]}
    return {endpoint:(numerators[endpoint]+200*rate)/(weighted[0]+200) for endpoint,rate in league.items()}


def workload_baselines(ytd, prior, elapsed, remaining):
    if len(prior)!=3 or min(ytd,*prior)<0 or not 0<elapsed<162 or not 0<remaining<=162-elapsed+1e-9:
        raise ValueError("invalid history or schedule")
    annual=(3*prior[0]+2*prior[1]+prior[2])/6
    weight=elapsed/(elapsed+81)
    return dict(games=ytd*remaining/elapsed,
        multiyear=(weight*ytd*162/elapsed+(1-weight)*annual)*remaining/162)
