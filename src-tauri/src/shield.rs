use tauri::Url;

const AD_BLOCK_HOST_SUFFIXES: &[&str] = &[
    "doubleclick.net",
    "googlesyndication.com",
    "googleadservices.com",
    "adnxs.com",
    "adsystem.com",
    "taboola.com",
    "outbrain.com",
    "popads.net",
    "popcash.net",
    "propellerads.com",
    "propeller-tracking.com",
    "onclickads.net",
    "adsterra.com",
    "exoclick.com",
    "trafficjunky.net",
    "juicyads.com",
    "hilltopads.net",
    "yandexadexchange.net",
    "mgid.com",
    "revcontent.com",
    "media.net",
    "adform.net",
    "adsafeprotected.com",
    "adscore.com",
    "adskeeper.co.uk",
    "adskeeper.com",
    "adtelligent.com",
    "betweendigital.com",
    "bidgear.com",
    "clickadu.com",
    "clickaine.com",
    "clksite.com",
    "criteo.com",
    "criteo.net",
    "dtscout.com",
    "exdynsrv.com",
    "go2cloud.org",
    "histats.com",
    "in-page-push.com",
    "inpagepush.com",
    "intergient.com",
    "lijit.com",
    "magsrv.com",
    "onclickalgo.com",
    "onclickperformance.com",
    "popmonetizer.com",
    "popmyads.com",
    "pubfuture.com",
    "pushads.biz",
    "pushengage.com",
    "realsrv.com",
    "runative-syndicate.com",
    "runative.com",
    "shorte.st",
    "smartadserver.com",
    "smartstream.tv",
    "trafficfactory.biz",
    "trafficstars.com",
    "undertone.com",
    "yllix.com",
    "zedo.com",
];

const AD_BLOCK_URL_MARKERS: &[&str] = &[
    "/ads/",
    "/adserver/",
    "/advertising/",
    "/popunder/",
    "/popup/",
    "/prebid/",
    "/vast/",
    "/vpaid/",
    "/ima/",
    "adsterra",
    "propeller",
    "onclick",
    "popunder",
    "push_sub",
    "zoneid=",
    "campaignid=",
    "adzone=",
];

fn host_matches(host: &str, suffix: &str) -> bool {
    host == suffix || host.ends_with(&format!(".{suffix}"))
}

pub fn should_block_url(url: &Url) -> bool {
    let Some(host) = url.host_str().map(|host| host.to_ascii_lowercase()) else {
        return false;
    };

    if AD_BLOCK_HOST_SUFFIXES
        .iter()
        .any(|suffix| host_matches(&host, suffix))
    {
        return true;
    }

    let lowered_url = url.as_str().to_ascii_lowercase();
    AD_BLOCK_URL_MARKERS
        .iter()
        .any(|marker| lowered_url.contains(marker))
}
