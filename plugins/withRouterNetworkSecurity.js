// Config plugin: allow cleartext HTTP only to the router in release builds (AGENTS.md §8.6).
// The HiLink API has no HTTPS, so a global usesCleartextTraffic would be the only
// alternative — and that would allow plain HTTP to every host.
const { withAndroidManifest, withDangerousMod, AndroidConfig } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const ROUTER_HOSTS = ['192.168.8.1'];

const RELEASE_XML = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="false" />
  <domain-config cleartextTrafficPermitted="true">
${ROUTER_HOSTS.map((host) => `    <domain includeSubdomains="false">${host}</domain>`).join('\n')}
  </domain-config>
</network-security-config>
`;

// The debug source set overrides the main resource, so only debug builds can reach
// the Metro dev server (plain HTTP on the LAN).
const DEBUG_XML = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="true" />
</network-security-config>
`;

function writeXml(root, sourceSet, xml) {
  const dir = path.join(root, `app/src/${sourceSet}/res/xml`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'network_security_config.xml'), xml);
}

function withNetworkSecurityFiles(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      writeXml(cfg.modRequest.platformProjectRoot, 'main', RELEASE_XML);
      writeXml(cfg.modRequest.platformProjectRoot, 'debug', DEBUG_XML);
      return cfg;
    },
  ]);
}

function withNetworkSecurityManifest(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    app.$['android:networkSecurityConfig'] = '@xml/network_security_config';
    delete app.$['android:usesCleartextTraffic'];
    return cfg;
  });
}

module.exports = function withRouterNetworkSecurity(config) {
  return withNetworkSecurityManifest(withNetworkSecurityFiles(config));
};
