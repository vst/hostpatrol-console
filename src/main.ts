function loadFile(file: File, callback: (x: any) => void) {
  const reader = new FileReader();

  reader.onload = function (evt: any) {
    localStorage.setItem("hostpatrol.report", evt.target.result);
    callback(loadData());
  };

  reader.onerror = function (evt: any) {
    console.error("error reading file", evt);
  };

  reader.readAsText(file, "UTF-8");
}

function loadData() {
  const report = localStorage.getItem("hostpatrol.report");

  try {
    if (report) {
      return { data: enrichData(JSON.parse(report)) };
    } else {
      return null;
    }
  } catch (e) {
    console.error("Failed to parse reports from localStorage", e);
    return {
      error:
        "Failed to parse report. Please make sure that you have chosen a valid Host Patrol report file.",
    };
  }
}

function clearData() {
  localStorage.removeItem("hostpatrol.report");
}

function enrichData(data: any) {
  data = addHostIds(data);
  data = addUniqueAuthorizedSshKeysCount(data);
  data = updateCloudName(data);
  data = addAllKnownSshKeys(data);
  data = annotateAuthorizedSshKeys(data);

  return {
    ...data,
    charts: mkChartData(data),
    sshKeysReport: buildSshKeysReport(data),
  };
}

function mkChartData(data: any) {
  const { hosts } = data;

  const oss = mkBarChartData(hosts.map((x: any) => x.distribution.name));
  const clouds = mkBarChartData(hosts.map((x: any) => x.cloud.name));
  const timezones = mkBarChartData(
    hosts.map((x: any) => x.timezone.split(" ")[0]),
  );

  const { allAuthorizedSshKeys, allKnownSshKeys } = data;

  return {
    oss,
    clouds,
    timezones,
    sshKeys: [
      {
        label: "Known",
        count: allAuthorizedSshKeys.intersection(allKnownSshKeys).size,
      },
      {
        label: "Unknown",
        count: allAuthorizedSshKeys.difference(allKnownSshKeys).size,
      },
    ],
  };
}

function mkBarChartData(xs: any) {
  return Object.entries(count(xs)).map(([label, count]) => ({
    label,
    count,
  }));
}

function count(xs: string[]) {
  return xs.reduce(
    (acc, c) => ({ ...acc, [c]: (acc[c] || 0) + 1 }),
    {} as Record<string, number>,
  );
}

function addHostIds(data: any): any {
  data.hosts = data.hosts.map((host: any, idx: number) => ({
    ...host,
    id: idx + 1,
  }));

  return data;
}

function addUniqueAuthorizedSshKeysCount(data: any): any {
  for (const host of data.hosts) {
    host.uniqueAuthorizedSshKeysCount = new Set(
      host.authorizedSshKeys.map((x: any) => x.fingerprint),
    ).size;
  }
  return data;
}

function updateCloudName(data: any): any {
  for (const host of data.hosts) {
    host.cloud.label = host.cloud.name === "UNKNOWN" ? "" : host.cloud.name;
  }
  return data;
}

function addAllKnownSshKeys(data: any): any {
  const knownSshKeys = new Set<string>(
    data.knownSshKeys.map((x: any) => x.fingerprint),
  );

  const authorizedSshKeys = new Set<string>([]);

  for (const host of data.hosts) {
    for (const key of host.host.knownSshKeys) {
      knownSshKeys.add(key.fingerprint);
    }

    for (const key of host.authorizedSshKeys) {
      authorizedSshKeys.add(key.fingerprint);
    }
  }

  data.allKnownSshKeys = knownSshKeys;
  data.allAuthorizedSshKeys = authorizedSshKeys;

  return data;
}

function annotateAuthorizedSshKeys(data: any): any {
  const { allKnownSshKeys } = data;

  for (const host of data.hosts) {
    for (const key of host.authorizedSshKeys) {
      key.isKnown = allKnownSshKeys.has(key.fingerprint);
    }
  }

  return data;
}

interface SshKeyReportInner {
  fingerprint: string;
  type: string;
  length: number;
  knownAs: Set<string>;
  seenAs: Set<string>;
  seenOn: Set<string>;
}

type SshKeysReportInner = Record<string, SshKeyReportInner>;

interface SshKeyReport {
  fingerprint: string;
  type: string;
  length: number;
  knownAs: string[];
  seenAs: string[];
  seenOn: string[];
}

function buildSshKeysReport(data: any): SshKeyReport[] {
  return Object.values(buildSshKeysReportInner(data)).map((x) => ({
    ...x,
    knownAs: Array.from(x.knownAs).sort(),
    seenAs: Array.from(x.seenAs).sort(),
    seenOn: Array.from(x.seenOn).sort(),
  }));
}

function buildSshKeysReportInner(data: any): SshKeysReportInner {
  const retval = {} as SshKeysReportInner;

  for (const host of data.hosts) {
    for (const key of host.authorizedSshKeys) {
      if (!retval[key.fingerprint]) {
        retval[key.fingerprint] = {
          fingerprint: key.fingerprint,
          type: key.type,
          length: key.length,
          knownAs: new Set<string>(),
          seenAs: new Set<string>(),
          seenOn: new Set<string>(),
        };
      }

      retval[key.fingerprint].seenAs.add(key.comment || "<unknown>");
      retval[key.fingerprint].seenOn.add(host.host.name);
    }
  }

  for (const key of data.knownSshKeys) {
    if (retval[key.fingerprint]) {
      retval[key.fingerprint].knownAs.add(key.comment || "<unknown>");
    }
  }

  for (const host of data.hosts) {
    for (const key of host.host.knownSshKeys) {
      if (retval[key.fingerprint]) {
        retval[key.fingerprint].knownAs.add(key.comment || "<unknown>");
      }
    }
  }

  return retval;
}

if (typeof window !== "undefined") {
  window.loadFile = loadFile;
  window.loadData = loadData;
  window.clearData = clearData;
}
