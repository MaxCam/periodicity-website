// Note: use JSONP for all requests to Atlas
var atlas = "https://atlas.ripe.net/api/v2/";

// Note: CORS is enabled on our server, make plain JSON requests
var dia = "https://webrobotics.net/json.php?callback=?&resource=http://nero.dia.uniroma3.it:8080/api/v0/";

var loadCitiesUrl = "https://webrobotics.net/nearest-city.php";
var tplay = "https://www.dia.uniroma3.it/~compunet/projects/radian/client/index_atlas_anchors.html";


var selection;


function loadAnchorsData(callback) {
    $.getJSON("anchors.json", function (data) {
        callback(data);
    });
}


function loadCountryCodes(callback) {
    $.getJSON("countries.json", function (data) {
        callback(data);
    });
}

function loadProbeIds(msm_id, callback) {
    var cache = loadProbeIds.cache;
    if (msm_id in cache) {
        callback(cache[msm_id]);
        return;
    }
    $.getJSON(atlas + "measurements/" + msm_id + "/?fields=probes&callback=?", function (data) {
        cache[msm_id] = data.probes.map(function (probe) { return probe.id });
        callback(cache[msm_id]);
    });
}
loadProbeIds.cache = {};


function loadProbes(probeIds, callback) {
    var cache = loadProbes.cache;
    var newProbeIds = probeIds.filter(function (id) { return !(id in cache) });
    if (newProbeIds.length == 0) {
        callback(probeIds.map(function (id) { return cache[id] }));
        return;
    }
    var fields = ["id", "address_v4", "asn_v4", "country_code", "status", "geometry"];
    var pageSize = 500;
    var numPages = Math.ceil(newProbeIds.length / pageSize);
    var url = atlas
        + "probes/?id__in=" + newProbeIds.join(",")
        + "&fields=" + fields.join(",")
        + "&callback=?&page_size=" + pageSize;
    var page = 1;

    async.whilst(
        function () {
            return page <= numPages;
        },
        function (callback) {
            $.getJSON(url + "&page=" + page)
                .done(function (data) {
                    data.results.forEach(function (probe) {
                        if (probe.status.name != "Connected")
                            return;
                        cache[probe.id] = {
                            id: probe.id,
                            address_v4: probe.address_v4,
                            asn_v4: probe.asn_v4,
                            country_code: probe.country_code,
                            longitude: probe.geometry.coordinates[0],
                            latitude: probe.geometry.coordinates[1]
                        };
                    });
                    callback(null);
                })
                .fail(function(jqxhr, textStatus, error) {
                    console.error(jqxhr, textStatus, error);
                    callback(error);
                });
            page++;
        },
        function (err) {
            if (err) {
                console.error("Cannot load probes: " + err);
                return;
            }
            // Return only probes for which we could load data from Atlas
            var goodProbeIds = probeIds.filter(function (id) { return (id in cache) });
            var probes = goodProbeIds.map(function (id) { return cache[id] });
            callback(probes);
        }
    );
}
loadProbes.cache = {};


function loadAsHolders(probes, callback) {
    var cache = loadAsHolders.cache;
    var asns = probes.map(function (p) { return p.asn_v4 }).filter(function (asn) { return asn });
    $.getJSON(dia + "as-holders/" + asns.join(","), function (data) {
        if (data.error != undefined) {
            console.error("Could not load AS holders", data.error);
        } else {
            for (var asn in data) {
                var holder = data[asn];
                if (holder != "unknown")
                    cache[asn] = data[asn];
            }
        }
        callback(cache);
    });
}
loadAsHolders.cache = {};


function loadCities(probes, callback) {
    var cache = loadCities.cache;
    var latitude = probes.map(function (p) { return p.latitude });
    var longitude = probes.map(function (p) { return p.longitude });

    $.ajax({
        type: "POST",
        dataType: "json",
        async: true,
        cache: false,
        //timeout: config.ajaxTimeout,
        url: loadCitiesUrl,
        data: {
            latitude: latitude.join(","),
            longitude: longitude.join(",")
        },
        success: function (data) {
            for (var i = 0; i < probes.length; i++) {
                if (data.cities[i] != "")
                    cache[probes[i].id] = data.cities[i];
            }
            callback(cache);
        },
        error: function (error) {
            console.error("Could not load cities", error);
        }
    });
}
loadCities.cache = {};


function ProbeGrouping(countries, asn2holder, probeCity) {

    var rootKey = function (_) { return "all" };

    var asnKey = function (probe) {
        if (probe.asn_v4) {
            var asn = probe.asn_v4;
            if (asn2holder[asn])
                return "AS" + asn + " " + asn2holder[asn].substr(0, 50);
            else
                return "AS" + asn;
        } else {
            return "unknown";
        }
    };

    var countryKey = function (probe) {
        var record = countries[probe.country_code];
        return record ? probe.country_code : "unknown country"
    };

    var continentKey = function (probe) {
        var record = countries[probe.country_code];
        return (record != undefined ? record.continent : "unknown continent");
    };

    var cityKey = function (probe) {
        if (probe.city)
            return probe.city;
        else if (probe.id in probeCity)
            return probeCity[probe.id];
        else
            return "unknown city";
    }

    var rootIcon = function (_) { return "images2/world1.png" };
    var continentIcon = function (continent) { return "images2/continent3.jpg" };
    var countryIcon = function (countryCode) { return "flag_icons/" + countryCode.toLowerCase() + ".png" };
    var cityIcon = function (city) { return "images2/city3.png" };
    var anchorIcon = function (anchor) { return "images2/device.png" };
    var probeIcon = function (anchor) { return "images2/device.png" };

    var rootText = function (_) { return "World" };
    var continentText = function (continent) { return continent };
    var countryText = function (countryCode) {
        return countryCode in countries ? countries[countryCode].country : "unknown country"
    };
    var cityText = function (city) { return city };
    var anchorText = function (anchor) {
        var asn = anchor.asn_v4;
        var holder = asn in asn2holder ? asn2holder[asn] : "";
        var as = "AS" + asn + " " + holder;
        var value = anchor.v4_msm_id;
        var label = anchor.id + " " + as;
        return '<input type="radio" name="anchor_radio" value="' + value + '">' + label;
    };
    var probeText = function (probe) {
        var id = probe.id;
        var asn = probe.asn_v4;
        var holder = asn in asn2holder ? asn2holder[asn] : "";
        var as = asn ? "AS" + asn + " " + holder : "";
        return '<input type="checkbox" class="probe_check" value="' + id + '">' + id + " " + as;
    }

    this.rootKey = rootKey;
    this.rootIcon = rootIcon;
    this.rootText = rootText;
    this.groupKeys = [continentKey, countryKey, cityKey];
    this.groupIcons = [continentIcon, countryIcon, cityIcon];
    this.groupTexts = [continentText, countryText, cityText];
    this.anchorIcon = anchorIcon;
    this.anchorText = anchorText;
    this.probeIcon = probeIcon;
    this.probeText = probeText;
}


function populateProbesMenuD3(groupedProbes, container, rootKey, rootIcon, rootText, groupIcons, groupTexts, probeIcon, probeText) {
    var nextId = populateProbesMenuD3.nextId;
    var tree = $(container).easytree();
    var rootNode = { id: "root" + (nextId++), text: rootText(), isFolder: true, iconUrl: rootIcon() };
    tree.addNode(rootNode);

    var aux = function (group, parentNode, groupIcons_, groupTexts_) {
        if ($.isArray(group)) {
            group.sort(function (probe1, probe2) {
                var asn1 = probe1.asn_v4;
                var asn2 = probe2.asn_v4;
                return (asn1 != asn2 ? asn1 - asn2 : probe1.id - probe2.id);
            });
            group.forEach(function (probe) {
                var icon = probeIcon(probe);
                var text = probeText(probe);
                var node = { id: "node" + (nextId++), text: text, isFolder: false, iconUrl: icon };
                tree.addNode(node, parentNode.id);
            })
        } else {
            var groupIcon = groupIcons_.slice(0, 1)[0];
            var groupText = groupTexts_.slice(0, 1)[0];
            Object.keys(group)
                .sort(function (a,b) { return groupText(a).localeCompare(groupText(b)) })
                .forEach(function (entry) {
                    var text = groupText(entry);
                    var icon = groupIcon(entry);
                    var node = { id: "node" + (nextId++), text: text, isFolder: true, iconUrl: icon };
                    tree.addNode(node, parentNode.id);
                    aux(group[entry], node, groupIcons_.slice(1), groupTexts_.slice(1));
                });
        }
    }

    aux(groupedProbes[rootKey()], rootNode, groupIcons, groupTexts);
    tree.rebuildTree();
    populateProbesMenuD3.nextId = nextId;
    return tree;
}
populateProbesMenuD3.nextId = 1;


function groupProbes(probes, rootKey, groupKeys) {

    var aux = function(groups, keys) {
        if (keys.length == 0)
            return;
        var key = keys.slice(0, 1)[0];
        for (var g1 in groups) {
            var subGroups = {};
            groups[g1].forEach(function (probe) {
                var g2 = key(probe);
                if (subGroups[g2] == undefined)
                    subGroups[g2] = [];
                subGroups[g2].push(probe);
            });
            groups[g1] = subGroups;
        }
        for (var g1 in groups) {
            aux(groups[g1], keys.slice(1));
        }
    };

    var groupedProbes = {};
    groupedProbes[rootKey()] = probes.slice(0);
    aux(groupedProbes, groupKeys);
    return groupedProbes;
}


function emptyProbesMenu() {
    $("#probe_tree").empty();
    $("#probe_as_selector select").empty();
    $("#probe_as_selector .applyFilter_button").off("click");
    $("#probe_as_selector .clearFilter_button").off("click");
    $("#probe_as_selector").hide();
}


function filterTree(tree, selectedAsns, originalNodes) {

    function cloneNode(node) {
        var clone = {children: []};
        for (var p in node)
            if (p != "children")
                clone[p] = node[p];
        return clone;
    }

    function filter(node) {
        if (node.children == undefined) {
            var match = node.text.match(/AS([0-9]+)/);
            var asn = match != null ? match[1] : "unknown_as";
            var res = selectedAsns.indexOf(asn) != -1 ? cloneNode(node) : null;
            return res;
        }
        var clone = cloneNode(node);
        clone.isExpanded = true;
        clone.children = node.children.map(filter).filter(function (child) { return child != null });
        return clone.children.length > 0 ? clone : null;
    }

    var filteredNodes = filter(originalNodes);
    if (filteredNodes == null)
        throw "Failed assertion: null root if filtering by ASes " + JSON.stringify(selectedAsns);
    tree.rebuildTree([filteredNodes]);
}


function resetTree(tree, originalNodes) {

    function collapseAll(node) {
        node.isExpanded = false;
        if (node.children != undefined)
            node.children.forEach(function (child) { collapseAll(child) });
    }

    collapseAll(originalNodes);
    tree.rebuildTree([originalNodes]);
}


function populateAsSelector(containerId, anchors, asn2holder, tree, onFilter) {
    var container = $(containerId);
    var menu = container.find("select");
    var asns = anchors.reduce(function (r, a) { r[a.asn_v4 || "unknown_as"] = true; return r }, {});
    Object.keys(asns).sort(function (a, b) { return a.localeCompare(b, [], {numeric: true}) }).forEach(function (asn) {
        var holder = asn in asn2holder ? asn2holder[asn] : "";
        var text = asn != "unknown_as" ? "AS" + asn + " " + holder : "Unknown AS";
        menu.append('<option value="' + asn + '">' + text + '</option>');
    });
    var allNodes = tree.getAllNodes()[0];
    container.find(".applyFilter_button").click(function() {
        var selectedAsns = menu.val() || [];
        if (selectedAsns.length > 0)
            filterTree(tree, selectedAsns, allNodes);
        else
            resetTree(tree, allNodes);
        onFilter();
    });
    container.find(".clearFilter_button").click(function() {
        resetTree(tree, allNodes);
        onFilter();
    });
    container.show();
}


function shuffle(a) {
    var j, x, i;
    for (i = a.length; i; i--) {
        j = Math.floor(Math.random() * i);
        x = a[i - 1];
        a[i - 1] = a[j];
        a[j] = x;
    }
}


function onLaunchtplayButtonClick() {
    document.location = "https://massimo.ripe.net/periodicity-calculate/" +
        "?start=1460505600" +
        "&stop=1460592000" +
        "&probe=" + selection.probes[0] +
        "&measurement=5029" + selection.msm;
}


function onAnchorChange(msm_id, countries, urlParams) {
    $("body").css('cursor', 'progress');
    $("#probe_tree").html("<span>Loading...</span>");
    loadProbeIds(msm_id, function (probeIds) {
        loadProbes(probeIds, function (probes) {
            loadAsHolders(probes, function (asn2holder) {
                loadCities(probes, function (probeCity) {
                    var grouping = new ProbeGrouping(countries, asn2holder, probeCity);
                    var groupedProbes = groupProbes(probes, grouping.rootKey, grouping.groupKeys);
                    var probeTree = populateProbesMenuD3(groupedProbes, "#probe_tree", grouping.rootKey, grouping.rootIcon, grouping.rootText, grouping.groupIcons, grouping.groupTexts, grouping.probeIcon, grouping.probeText);

                    function setupProbeChecks() {
                        var probeChecks = $('input[type=checkbox][class=probe_check]');
                        probeChecks.attr("checked", false);
                        $("#loading_status_atlas").html("");
                        var maxProbes = parseInt(urlParams["maxProbes"] || "1");
                        // $("#launchtplay_button").attr("disabled", false);

                        selection = {
                            msm: msm_id,
                            probes: $(".probe_check:checked").map(function () { return $(this).val() }).toArray()
                        };
                        probeChecks.change(function() {
                            var numSelectedProbes = $(".probe_check:checked").length;
                            if (numSelectedProbes == maxProbes + 1) {
                                
                                $("#loading_status_atlas").css("color", "orangered").html("We are sorry! You can select maximum one probe");
                                this.checked = false;
                                // $("#launchtplay_button").attr("disabled", true);
                                return false;
                            } else {
                                selection = {
                                    msm: msm_id,
                                    probes: $(".probe_check:checked").map(function () { return $(this).val() }).toArray()
                                };
                            }
                            $("#loading_status_atlas").html("");
                        });
                    }

                    setupProbeChecks();
                    populateAsSelector("#probe_as_selector", probes, asn2holder, probeTree, setupProbeChecks);
                    $("body").css('cursor', 'auto');
                });
            });
        });
    });
}


function readUrlParameters() {
    var format = /^[0-9a-zA-Z]+$/;
    var urlParams = location.search
        .substr(1)
        .split("&")
        .filter(function (param) { return param.indexOf("=") > -1 })
        .map(function (param) { return param.split("=") })
        .map(function (param) { return [param[0], decodeURIComponent(param[1])] })
        .filter(function (param) { return format.test(param[0]) && format.test(param[1]) })
        .reduce(function (res, param) { res[param[0]] = param[1]; return res }, {});

    return urlParams;
}


$(document).ready(function () {
    var urlParams = readUrlParameters();
    loadAnchorsData(function (allAnchors) {
        loadCountryCodes(function (countries) {
            loadAsHolders(allAnchors, function (asn2holder) {
                var grouping = new ProbeGrouping(countries, asn2holder, null);
                var groupedAnchors = groupProbes(allAnchors, grouping.rootKey, grouping.groupKeys);
                var anchorTree = populateProbesMenuD3(groupedAnchors, "#anchor_tree", grouping.rootKey, grouping.rootIcon, grouping.rootText, grouping.groupIcons, grouping.groupTexts, grouping.anchorIcon, grouping.anchorText);

                function setupAnchorRadios() {
                    emptyProbesMenu();
                    // $("#launchtplay_button").attr("disabled", true);
                    $("#loading_status_atlas").html("");
                    var anchorRadios = $('input[type=radio][name=anchor_radio]');
                    anchorRadios.attr("checked", false);
                    anchorRadios.change(function() {
                        emptyProbesMenu();
                        // $("#launchtplay_button").attr("disabled", true);
                        $("#loading_status_atlas").html("");
                        var msmId = this.value;
                        onAnchorChange(msmId, countries, urlParams);
                    });
                }

                setupAnchorRadios();
                populateAsSelector("#anchor_as_selector", allAnchors, asn2holder, anchorTree, setupAnchorRadios);
                $("#launchtplay_button").click(onLaunchtplayButtonClick);
            });
        })
    });
});
