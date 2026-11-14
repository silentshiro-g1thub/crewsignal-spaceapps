use crate::models::CommandError;
use url::Url;

const ALLOWED_HTTPS_HOSTS: &[&str] = &[
    "www.nasa.gov",
    "www.asc-csa.gc.ca",
    "nasa.gov",
    "humanresearchroadmap.nasa.gov",
    "ntrs.nasa.gov",
    "standards.nasa.gov",
    "wwwn.cdc.gov",
    "www.cdc.gov",
    "cdc.gov",
    "www.nist.gov",
    "medlineplus.gov",
    "www.heart.org",
    "www.fda.gov",
    "www.nhlbi.nih.gov",
    "nist.gov",
    "www.spaceappschallenge.org",
    "spaceappschallenge.org",
    "developer.mozilla.org",
    "www.w3.org",
];

pub fn validate_external_https_url(raw: &str) -> Result<String, CommandError> {
    let invalid_url = || {
        CommandError::new(
            "INVALID_EXTERNAL_URL",
            "Only allowlisted HTTPS reference URLs can be opened externally.",
        )
    };
    let parsed = Url::parse(raw.trim()).map_err(|_| invalid_url())?;
    if parsed.scheme() != "https" || !parsed.username().is_empty() || parsed.password().is_some() {
        return Err(invalid_url());
    }
    let host = parsed.host_str().ok_or_else(invalid_url)?;
    if !ALLOWED_HTTPS_HOSTS.contains(&host) {
        return Err(CommandError::with_detail(
            "DISALLOWED_EXTERNAL_HOST",
            "External URL host is outside CrewSignal's documented source registry.",
            host.to_owned(),
        ));
    }

    Ok(parsed.to_string())
}

#[cfg(target_os = "windows")]
pub fn detect_webview2_version() -> Option<String> {
    use std::process::Command;

    let keys = [
        r"HKLM\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
        r"HKCU\Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
    ];
    for key in keys {
        if let Ok(output) = Command::new("reg").args(["query", key, "/v", "pv"]).output() {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                for line in stdout.lines() {
                    if line.contains("pv") && line.contains("REG_SZ") {
                        if let Some(ver) = line.split_whitespace().last() {
                            return Some(ver.to_string());
                        }
                    }
                }
            }
        }
    }
    None
}

#[cfg(not(target_os = "windows"))]
pub fn detect_webview2_version() -> Option<String> {
    None
}

#[cfg(test)]
mod tests {
    use super::validate_external_https_url;

    #[test]
    fn allows_documented_publisher_urls() {
        assert!(validate_external_https_url("https://www.nasa.gov/hrp/risks/").is_ok());
        assert!(validate_external_https_url("https://www.nasa.gov/hrp/ongoing-hrp-research/").is_ok());
        assert!(validate_external_https_url("https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp").is_ok());
        assert!(validate_external_https_url("https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp").is_ok());
        assert!(validate_external_https_url("https://www.nasa.gov/hrp/hazards/").is_ok());
        assert!(validate_external_https_url(
            "https://wwwn.cdc.gov/nchs/data/nhanes/public/2021/labmethods/GLU-L-MET-508.pdf"
        )
        .is_ok());
        assert!(validate_external_https_url(
            "https://www.nist.gov/pml/owm/si-units-temperature"
        )
        .is_ok());
    }

    #[test]
    fn rejects_non_https_and_unknown_hosts() {
        assert!(validate_external_https_url("http://www.nasa.gov/").is_err());
        assert!(validate_external_https_url("file:///C:/Windows/System32/calc.exe").is_err());
        assert!(validate_external_https_url("https://evil.example.com/phish").is_err());
        assert!(validate_external_https_url("https://www.asc-csa.gc.ca.example.com/").is_err());
        assert!(validate_external_https_url("https://www.nasa.gov:443@example.com/").is_err());
        assert!(validate_external_https_url("https://user@www.nasa.gov/").is_err());
    }
}
