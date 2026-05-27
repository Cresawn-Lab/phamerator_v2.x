import { Datasets } from "/imports/api/collections";
import { ReactiveVar } from 'meteor/reactive-var';
import { TRNAs } from "/imports/api/collections";
import { Genes } from "/imports/api/collections";
import { Genomes } from "/imports/api/collections";
import { Phams } from "/imports/api/collections";
import { Proteins } from "/imports/api/collections";
import { Domains } from "/imports/api/collections";
import Clipboard from 'clipboard';
import d3 from 'd3';

let isTransitioning = false;

/**
 * Helper to parse SVG transform strings since d3.transform was removed in D3 v4
 */
// Function to adjust SVG height based on content
function adjust_map_height(useBBox = false) {
  if (typeof svgMap !== 'undefined' && svgMap && svgMap.node()) {
    // Calculate a safe minimum height based on the number of genomes
    var genomeCount = selectedGenomes.find().count();
    var minHeight = (genomeCount * 300) + 200;

    var newHeight = minHeight;

    if (useBBox) {
      var bbox = svgMap.node().getBBox();
      if (bbox && bbox.height > 0) {
        var contentHeight = Math.ceil(bbox.y + bbox.height + 100);
        newHeight = Math.max(minHeight, contentHeight);
      }
    }
    
    // Only update if the change is significant to avoid jitter
    var currentHeight = +svgMap.attr("height") || 0;
    if (Math.abs(newHeight - currentHeight) > 10) {
        svgMap.attr("height", newHeight);
    }
  }
}

function getTranslate(selection) {
  const transform = selection.attr("transform");
  if (!transform) return { translate: [0, 0] };
  const match = transform.match(/translate\(([^,)]+)[, ]*([^)]+)?\)/);
  if (!match) return { translate: [0, 0] };
  return {
    translate: [
      parseFloat(match[1]) || 0,
      parseFloat(match[2]) || 0
    ]
  };
}


var clipboard = new Clipboard('.btn-copy-link');
clipboard.on('success', function (e) {
  M.toast({ html: 'sequence copied!', displayLength: 1000 });
  e.clearSelection();
});

Template.phages.onCreated(function () {
  var self = this;
  self.autorun(function () {
    var dataset = Session.get('currentDataset');
    self.subscribe('allUsers');
  });
});

genomesWithSeqHandlers = [];

let last_known_scroll_position = 0;
let ticking = false;

function updateStickyLabels(scroll_pos) {
  // Pin the phage name labels to the left as the user scrolls horizontally
  d3.selectAll('text.phagename').attr('transform', function () {
    return 'translate(' + scroll_pos + ', -120)';
  });
}

// This listener is now moved to the specific map container in onRendered for horizontal stickiness

adjust_skew_all = function () {
  var phages = d3.selectAll(".phages")
  phages.each(function (d) {
    adjust_skew(null, this);
  });
}

var blastAlignmentsOutstanding = 0;

function viewMapTabClicked() {

  Meteor.subscribe('featureDiscovery', function () {
    var user = Meteor.user();
    if (user && user.featureDiscovery && user.featureDiscovery.length > 0) {
      var featureKey = user.featureDiscovery[0];

      if (typeof features !== 'undefined' && features[featureKey] != null) {
        Session.set("newFeatureTitle", features[featureKey].title);
        Session.set("newFeatureBody", features[featureKey].body);
        Session.set("newFeatureDismiss", features.dismiss);
      }
    }
  });

  if (Session.get("newFeature") === true) {
    $('.tap-target').tapTarget('open');
  }
}

function reSort() {
  body.selectAll("div.data").sort(function (a, b) {
    if ((a.favorite) && !(b.favorite)) {
      return 1;
    }
    else if (b.favorite && !(a.favorite)) {
      return -1;
    }
    if (a.cluster < b.cluster) {
      return -1;
    }
    else if (a.cluster > b.cluster) {
      return 1;
    }
    else if (+a.subcluster !== +b.subcluster) {
      return +a.subcluster - +b.subcluster;
    }
    else if (a.phagename < b.phagename) {
      return -1;
    }
    else { return 1; }
  })
    .transition().duration(500)
    .style("top", function (d, i) {
      return 60 + ((i * 30)) + "px";
    })
}

var colorsys = require('colorsys');
hspData = [];
var d3line2 = d3.line()
  .x(function (d) {
    return d.x;
  })
  .y(function (d, i) {
    return (d.y);
  })
  .curve(d3.curveLinearClosed);

function complement(a) {
  return { A: 'T', T: 'A', G: 'C', C: 'G' }[a];
}

function findElement(arg) {
  return (arg.query === this.query && arg.subject === this.subject);
}

Array.prototype.diff = function (a) {
  return this.filter(function (element, index, array) {
    return !(a.find(findElement, element));
  });
};

selectedGenomes = new Meteor.Collection(null);
alignedGenomes = new Meteor.Collection(null);

function update_hsps(hspData) {
  hspGroup = mapGroup.selectAll(".hspGroup")
    .data(hspData, function (d) {
      return d.queryName + "___" + d.subjectName;
    });

  // Synchronously and immediately remove exiting nodes
  // Do NOT add a transition here! Subsquent lines apply d3.selectAll(".hspGroup").transition()
  // which will accidentally cancel any scheduled removal transitions on exiting nodes.
  hspGroup.exit().remove();

  d3.selectAll(".hsp")
    .transition()
    .duration(1000)
    .style("opacity", function () {
      if (Session.get("showhspGroups") === true) {
        return 0.3;
      }
      else {
        return 0;
      }
    });

  var hspGroupEnter = hspGroup.enter().insert("g", ":first-child")
    .classed("hspGroup", true)
    .attr("id", function (d) {
      return "phage_" + d.queryName.replace(/\./g, '_dot_').replace(/ /g, '_space_') + "___phage_" + d.subjectName.replace(/\./g, '_dot_').replace(/ /g, '_space_');
    });

  hspGroup = hspGroupEnter.merge(hspGroup);

  hspGroupEnter.each(function (d) {
      let queryName = d.queryName;
      let subjectName = d.subjectName;
      queryName = queryName.replace(/\./g, '_dot_').replace(/ /g, '_space_');
      subjectName = subjectName.replace(/\./g, '_dot_').replace(/ /g, '_space_');
      var hsps = svgMap.selectAll("g#phage_" + queryName + "___phage_" + subjectName + ".hspGroup")
        .selectAll(".hsp")
        .data(function (d) {
          return d.genome_pair_hsps;
        });

      hsps.exit().remove();

      var hspsEnter = hsps.enter()
        .insert("svg:path", ":first-child")
        .classed("hsp", true);

      var hspsMerged = hspsEnter.merge(hsps);

      hspsEnter
        .style("opacity", 0)
        .transition()
        .duration(1200)
        .style("opacity", function () {
          if (Session.get("showhspGroups") === true) {
            return 0.3
          }
          else {
            return 0;
          }
        });

      // Existing HSPs will be updated by the transition at the start of update_hsps

      hspsMerged
        .on("mouseover", function (event, d) {
          d3.select(this).style("stroke", "black").style("stroke-width", "2");
          tooltip.html("e-value: " + d[0].evalue.toExponential(3) + "<br>" + d[0].identity + "/" + d[0].align_len + " (" + d3.format("0.000%")(d[0].identity / d[0].align_len) + ")");
          
          let x = event.pageX;
          let y = event.pageY + 50;
          
          // If we're on the right half of the screen, flip the tooltip to the left
          if (x > window.innerWidth / 2) {
            x -= 160; 
          }

          tooltip.style("left", x + "px")
            .style("top", y + "px")
            .style("opacity", 0)
            .transition()
            .duration(250)
            .style("opacity", 1);
          return tooltip.style("visibility", "visible");
        })
        .on("mousemove", function (event) {
          let x = event.pageX;
          let y = event.pageY + 20;
          
          if (x > window.innerWidth / 2) {
             x -= 160;
          }
          
          return tooltip.style("top", y + "px").style("left", x + "px");
        })
        .on("mouseout", function () {
          d3.select(this).style("stroke-width", 0);
          tooltip
            .style("opacity", 0);
          return tooltip.style("visibility", "hidden");
        })
        .style("stroke-width", 0)
        .attr("d", function (d) {
          return d3line2(d);
        })
        .style("fill", function (d) {
          var evalue = d[0].evalue.toString();

          var array1 = evalue.split('e');
          var exp = array1[array1.length - 1];
          exp = Math.abs(+exp);
          if (exp == 0.0) { hue = 1.0; }
          else {
            hue = exp / 200.0;
          }
          hue = Math.min(hue, 0.75);

          var hexcolor = colorsys.hsv_to_hex({ h: hue * 360, s: 100, v: 100 });
          return hexcolor;
        })
        .style("visibility", function () {
          if (Session.get("showhspGroups") === true) {
            return "visible";
          }
          else {
            return "hidden";
          }
        });
    });

  hspGroup
    .attr("transform", function (d) {
      let queryName = d.queryName;
      queryName = queryName.replace(/\./g, '_dot_').replace(/ /g, '_space_')

      const phageSelection = d3.select('g#phage_' + queryName);
      if (!phageSelection.empty()) {
        const phageData = phageSelection.datum();
        let y;
        if (phageData && typeof phageData.ypos !== 'undefined') {
          y = phageData.ypos + 30;
        } else {
          var t = getTranslate(phageSelection);
          y = t.translate[1] + 30;
        }
        return "translate(0," + y + ")";
      }
    });

  if (Session.get("showhspGroups") === true) {
    d3.selectAll(".hspGroup").transition().duration(1000).style("opacity", 1);
  }
  adjust_skew_all();
  adjust_map_height(); // Ensure height is correct after HSPs are updated
  $("#preloader").fadeOut(300).hide();

}
var phageArray = [];
var map_order = [];

function update_phages() {
  // Use selectedGenomes as the primary source of truth for the list of phages to draw
  // This ensures the map "frame" (names/scales) shows up instantly even if sequence is still loading
  const selectedList = selectedGenomes.find({}, { sort: { phagename: 1 } }).fetch();
  pnames = selectedList.map(function (obj) { return obj.phagename; });

  // Enrich the static metadata with sequence data if it has arrived in the Genomes collection
  phagedata = selectedList.map(p => {
    // Look up the full database record (which includes the sequence if genomesWithSeq subscription is ready)
    const dbRecord = Genomes.findOne({ phagename: p.phagename });
    const merged = dbRecord || p;

    merged.selector = merged.phagename.replace(/\./g, '_dot_').replace(/ /g, '_space_');
    
    // Fetch genes from Genes collection (will be empty until selected_genes/tRNAs subscribe ready)
    merged.genes = Genes.find({ genome: merged._id }).fetch().map(g => {
      // Map Genes fields to what the map code expects
      return {
        start: g.start,
        stop: g.stop,
        name: g.name,
        direction: (g.direction === "R" || g.direction === "Reverse" || g.direction === "reverse") ? "reverse" : "forward",
        phamName: g.phamName,
        translation: g.translation,
        geneID: g.geneID,
        phamColor: g.phamColor,
        domainCount: g.domainCount,
        tmDomainCount: g.tmDomainCount,
        genefunction: g.genefunction || g.Notes || g.function || g.product || ""
      };
    });
    return merged;
  });

  phage = mapGroup.selectAll(".phages")
    .data(phagedata, function (d) {
      return d.phagename;
    });
  phage.exit().remove();

  phagedata = phage.data();

  d3.selectAll(".functionLabel")
    .transition()
    .duration(d3.max([500, phagedata.length * 20]))
    .attr("opacity", function () {
      if (Session.get("showFunctionLabels") === true) {
        return 1;
      }
      else {
        return 0;
      }
    });

  d3.selectAll(".generect")

    .attr("fill", function (d, i) {
      if (Session.get("colorByPhamAbundance") === true) {
        phamSize = phamsObj[+d.phamName];

        scaledAbundance = phamSize / maxPham;
        return ("hsl(0.66,0%," + (1 - (scaledAbundance)) * 100 + "%)");

      }
      else if (Session.get("colorByPhams") === true) {
        return d.phamColor;
      }
      else if (Session.get("colorByConservedDomains") === true) {
        return (d.domainCount > 0) ? "orange" : "white"
      }
      else if (Session.get("colorByTMDomains") === true) {
        return (d.tmDomainCount > 0) ? "dodgerblue" : "white"
      }
    })
    .attr("opacity", function (d) {
      return "1";
    });

  d3.selectAll(".geneNameLabel")
    .style("fill", function (d) {
      if (Session.get("showphamabcolor") === true) {
        phamSize = phamsObj[+d.phamName];
        scaledAbundance = phamSize / maxPham;
        if (scaledAbundance > 0.5) {
          return "white";
        }
        return "black";
      }
    });

  d3.selectAll(".phamLabel")
    .transition()
    .duration(d3.max([500, phagedata.length * 20]))
    .attr("opacity", function () {
      if (Session.get("showPhamLabels") === true) {
        return 1;
      }
      else {
        return 0;
      }
    });

  $("#preloader").fadeOut(300).hide();

  adjust_map_height(false);

  newPhages = phage.enter().append("g")
    .attr("id", function (d, i) { return "phage_" + d.selector.replace(/\./g, '_dot_').replace(/ /g, '_space_'); })
    .classed("phages", true);

  var minX = 0;
  var maxX = 0;
  var phages = d3.selectAll(".phages");
  phages.each(function (d) {
    minX = Math.min(minX, getTranslate(d3.select(this)).translate[0]);
    maxX = Math.max(maxX, getTranslate(d3.select(this)).translate[0] + (d.genomelength / 10));
  });

  svgMap.attr("width", function (d) {
    return (maxX - minX);
  })
    .attr("x", function (d) { return minX });
  svgMap.selectAll(".phages")
    .sort(function (a, b) {
      if (!a || !b) return 0;
      let aSelector = 'g#phage_' + a.selector.replace(/\./g, '_dot_').replace(/ /g, '_space_');
      let bSelector = 'g#phage_' + b.selector.replace(/\./g, '_dot_').replace(/ /g, '_space_');

      let aNode = d3.select(aSelector).node();
      let bNode = d3.select(bSelector).node();

      if (!aNode || !bNode) return 0;

      var ay = getTranslate(d3.select(aSelector)).translate[1];
      var by = getTranslate(d3.select(bSelector)).translate[1];

      // if both are old, sort by position (new genomes will be at position 0)
      if (ay > 0 && by > 0) {
        return ay - by;
      }

      // else if either or both are new, sort by cluster, then subcluster, then phagename
      else {
        if (a.cluster < b.cluster) {
          return -1;
        }
        else if (a.cluster > b.cluster) {
          return 1;
        }
        else if (+a.subcluster !== +b.subcluster) {
          return +a.subcluster - +b.subcluster;
        }
        else if (a.phagename < b.phagename) {
          return -1;
        }
        else { return 1; }
      }
    })

    .attr("transform", function (d, i) {
      if (!d || isTransitioning) return d3.select(this).attr("transform");
      let selector = 'g#phage_' + d.selector.replace(/\./g, '_dot_').replace(/ /g, '_space_');
      let node = d3.select(selector).node();
      if (!node) return "";

      d.ypos = (i * 300) + 150;
      return "translate(" + getTranslate(d3.select(selector)).translate[0]
        + "," + d.ypos + ")";
    });

  adjust_skew = function (event, genome) {
    if (!genome) return;

    var genomeSelection = d3.select(genome);
    if (!genomeSelection || !genomeSelection.node()) return;

    var t_genome = getTranslate(genomeSelection);
    if (typeof t_genome.translate[0] == "undefined") {
      genomeSelection.attr("transform", "translate(0," + t_genome.translate[1] + ")")
    }
    queryForThisSubjectName = null;
    subjectForThisQueryName = null;
    queryForThisSubjectX = null;
    subjectForThisQueryX = null;
    subjectForThisQuerySelection = null;
    queryForThisSubjectSelection = null;
    hspQueryPaths = null;
    hspSubjectPaths = null;

    hspGroupHeight = 270;
    // get the hspGroup whose subject is this genome
    hspGroupSubject = d3.selectAll(".hspGroup").filter(function (d) {
      // get only those .hspGroup that have the dragged subject
      return genome.id == "phage_" + d.subjectName.replace(/\./g, '_dot_').replace(/ /g, '_space_')
    });
    if (!hspGroupSubject.empty()) {
      hspSubjectPaths = hspGroupSubject.selectAll("path");

      // get the query of that subject (genome above this one)
      queryForThisSubjectName = hspGroupSubject.attr("id").split("___")[0].replace(/\./g, '_dot_').replace(/ /g, '_space_');
      queryForThisSubjectSelection = d3.select("g#" + queryForThisSubjectName);
      // get the offset of the genome above
      if (!queryForThisSubjectSelection.empty() && queryForThisSubjectSelection.node()) {
        queryForThisSubjectX = getTranslate(queryForThisSubjectSelection).translate[0];
      } else {
        queryForThisSubjectName = null;
      }
    }

    // get the hspGroup whose query is this genome
    hspGroupQuery = d3.selectAll(".hspGroup").filter(function (d) {
      // get only those .hspGroup that have the dragged query

      return genome.id == "phage_" + d.queryName.replace(/\./g, '_dot_').replace(/ /g, '_space_')
    });
    if (!hspGroupQuery.empty()) {
      hspQueryPaths = hspGroupQuery.selectAll("path");

      // get the subject of that query (genome below this one)
      subjectForThisQueryName = hspGroupQuery.attr("id").split("___")[1].replace(/\./g, '_dot_').replace(/ /g, '_space_');
      subjectForThisQuerySelection = d3.select("g#" + subjectForThisQueryName);
      if (!subjectForThisQuerySelection.empty() && subjectForThisQuerySelection.node()) {
        subjectForThisQueryX = getTranslate(subjectForThisQuerySelection).translate[0];
      } else {
        subjectForThisQueryName = null;
      }
    }
    if (event && event.x != undefined) {
      if ((event.x < svgMap.attr("x")) && event.x < 0) {
        // dragging this genome off the left end, keep this genome still and drag everything else to the right instead
        d3.select("#mapGroup")
          .attr("transform", function (d, i) {
            // move the genome along the x axis
            return "translate(" + -event.x + "," + 0 + ")";
          });
      }

      d3.select(genome)
        .attr("transform", function (d) {
          // move the genome along the x axis
          return "translate(" + event.x + "," + getTranslate(d3.select(genome)).translate[1] + ")";
        });
    }

    // if there is an hspGroup below this genome...
    var x = getTranslate(d3.select(genome)).translate[0];
    if (event && event.x != undefined) {
      var x = event.x;

    }
    if (subjectForThisQueryName != null) {
      hspQueryPaths.attr("transform", function (d) {
        var angle = Math.atan2(subjectForThisQueryX - x, hspGroupHeight) * (180 / Math.PI);
        return "skewX(" + angle + ")" + "translate(" + (x) + "," + 0 + ")";
      });
    }

    // if there is an hspGroup above this genome...
    if (queryForThisSubjectName != null) {
      hspSubjectPaths.attr("transform", function (d) {
        var angle = -Math.atan2(queryForThisSubjectX - x, hspGroupHeight) * (180 / Math.PI);
        return "skewX(" + angle + ")" + "translate(" + queryForThisSubjectX + "," + 0 + ")";
      })
    }
  }

  var drag = d3.drag()
    .subject(function (event, d) {
      var t = getTranslate(d3.select(this));
      return { x: t.translate[0], y: t.translate[1] };
    })

    .on("start", function (event, d) {
      dragging = this;
      if (!event.sourceEvent.shiftKey) {
        d3.selectAll(".hspGroup")
          .filter(function (h) {
            return h.queryName === d.phagename || h.subjectName === d.phagename;
          })
          .transition().duration(300)
          .style("opacity", 0);
      }
    })
    .on("drag", function (event, d) {
      d.ypos = getTranslate(d3.select(this)).translate[1];

      if (event.sourceEvent.shiftKey) {
        adjust_skew(event, dragging);
      }
      else {
        // vertical dragging
        d3.select(this)
          .attr("transform", function (d) {
            return "translate(" + getTranslate(d3.select(this)).translate[0] + "," + (event.y) + ")";
          });
      }
    })
    .on("end", function (event, d) {
      dragging = null;
      // Removed immediate update_phages() to prevent jumping/jitter
      // But ensure a stable height is set immediately
      adjust_map_height(false);
      
      if (event.sourceEvent.shiftKey) {
        adjust_skew_all();
      }

      else {
        d3.selectAll(".phages")
          .sort(function (a, b) {
            var ay = getTranslate(d3.select('g#phage_' + a.selector)).translate[1];
            var by = getTranslate(d3.select('g#phage_' + b.selector)).translate[1];
            return ay - by;
          })
          .transition().duration(1000)
          .attr("transform", function (d, i) {
            d.ypos = (i * 300) + 150;

            return "translate(" + getTranslate(d3.select(this)).translate[0] + "," + ((i * 300) + 150) + ")";
          })
          .on("start", function() { isTransitioning = true; })
          .on("end", function() { isTransitioning = false; });

        phagesdata = d3.selectAll(".phages").data();
        phagesdata.forEach((d, i) => { d.ypos = (i * 300) + 150; });
        var hspGroupData = d3.selectAll(".hspGroup").data();

        var genome_pairs = [];

        phagesdata.forEach(function (d, i) {
          var c = phagesdata[i - 1];
          if (c && d) {
            genome_pairs.push({ query: c.phagename, subject: d.phagename });
            if (c.sequence && d.sequence && alignedGenomes.find({ query: c.phagename, subject: d.phagename }).count() === 0) {
              blast(c, d);
            }
          }
        });

        tempAlign = alignedGenomes.find().fetch();
        tempAlign.diff(genome_pairs).forEach(function (v, i, a) {

          hspData = hspData.filter(function (e, j, b) {
            return !((e.queryName === v.query) && (e.subjectName === v.subject));
          });

          alignedGenomes.remove({ query: v.query, subject: v.subject });
        });
        
        // Update HSPs after genome transition finishes (1000ms + small buffer)
        setTimeout(update_hsps, 1100, hspData);
      }
    });

  phagedata = phage.data();

  // Add labels for new phage tracks
  newPhages.append("text")
    .classed("phagename", true)
    .attr("font-size", "24px")
    .attr("fill", "black")
    .style("text-anchor", "start")
    .attr("transform", "translate(0,-120)");

  // Update text content for all phage tracks (new and existing)
  phage.select("text.phagename")
    .text(function (d) {
      if (d.cluster === "" || d.cluster === "Singleton") {
        return d.phagename + " (Singleton)";
      }
      // Prioritize clusterSubcluster field; fallback to intelligent merge
      let label = d.clusterSubcluster;
      if (!label) {
        let sc = (d.subcluster || "").toString();
        let c = (d.cluster || "").toString();
        label = sc.startsWith(c) ? sc : c + sc;
      }
      return d.phagename + " (" + label + ")";
    })
    .attr("opacity", 1);

  newPhages.call(drag);

  newPhages.append("rect") // background for ruler
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", function (d) {
      return d.genomelength / 10;
    })
    .attr("height", 30)
    .style("stroke-width", "2px")
    .style("fill", "white")
    .style("stroke", "black")
    .attr("stroke-opacity", 0)
    .transition().duration(1000)
    .attr("stroke-opacity", 1);

  var group = newPhages.selectAll(".thousandticks")
    .data(function (d, i) {
      ticks = [];
      genome_positions = d3.range(d.genomelength);
      genome_positions.forEach(function (currentValue, index, myArray) {
        if (currentValue % 1000 === 0) {
          ticks.push(currentValue);
        }
      });
      return ticks;
    }
    )
    .enter()
    .append("g")
  group.append("rect") // 1 kb ticks
    .style("fill", "black")
    .attr("x", function (d) {
      return d / 10;
    })
    .attr("y", 0)
    .attr("width", "1px")
    .attr("height", 30)
    .attr("opacity", 0)
    .transition().duration(1500)
    .attr("opacity", 1);

  group.append("text") // kbp label
    .attr("x", function (d) {
      return (d / 10) + 3;
    })
    .attr("y", 12)
    .attr("font-size", "14px")
    .attr("fill", "green")
    .style("text-anchor", "start")
    .text(function (d) {
      return d / 1000;
    })
    .attr("opacity", 0)
    .transition().duration(1500)
    .attr("opacity", 1);
  var group2 = newPhages.selectAll(".fivehundredticks")
    .data(function (d) {
      ticks = [];
      genome_positions = d3.range(d.genomelength);
      genome_positions.forEach(function (currentValue, index, myArray) {
        if (currentValue % 500 === 0 & currentValue % 1000 !== 0) {
          ticks.push(currentValue);
        }
      });
      return ticks;
    })
    .enter()
    .append("g");
  group2.append("rect") // 500 bp ticks
    .style("fill", "black")
    .attr("x", function (d) {
      return d / 10;
    })
    .attr("y", 0)
    .attr("width", "1px")
    .attr("height", 15)
    .attr("opacity", 0)
    .transition().duration(1500)
    .attr("opacity", 1);
  var group3 = newPhages.selectAll(".onehundredticks")
    .data(function (d) {
      ticks = [];
      genome_positions = d3.range(d.genomelength);
      genome_positions.forEach(function (currentValue, index, myArray) {
        if (currentValue % 100 === 0 & currentValue % 1000 !== 0 & currentValue % 500 !== 0) {
          ticks.push(currentValue);
        }
      });
      return ticks;
    })
    .enter()
    .append("g");
  group3.append("rect") // 100 bp ticks
    .style("fill", "black")
    .attr("x", function (d) {
      return d / 10;
    })
    .attr("y", 15)
    .attr("width", "1px")
    .attr("height", 15)
    .attr("opacity", 0)
    .transition().duration(1500)
    .attr("opacity", 1);

  tRNA_group_x = function (d) {
    return d3.min([d.Start, d.Stop]) / 10;
  };
  tRNA_group_y = function (d) {
    if (d.Orientation == "F") {
      if (d.Name % 2 === 0) {
        return -70;
      }
      else { return -30; }
    }
    else if (d.Orientation == "R") {
      if (d.Name % 2 === 0) {
        return 30;
      }
      else { return 70; }
    }
  }
  var allPhages = svgMap.selectAll(".phages");
  
  let tRNAGroupSelection = allPhages.selectAll(".tRNAGroup")
    .data(function (d) {
      return TRNAs.find({ PhageID: d.phageID }).fetch()
    }, d => d.GeneID);

  tRNAGroupSelection.exit().remove();

  let tRNAGroupEnter = tRNAGroupSelection.enter()
    .append("g").classed('tRNAGroup', true);

  let tRNAGroup = tRNAGroupEnter.merge(tRNAGroupSelection);

  tRNAGroupEnter.append("rect");
  tRNAGroupEnter.append("text").classed("tRNALabel", true);

  tRNAGroup.attr('transform', d => `translate(${tRNA_group_x(d)}, ${tRNA_group_y(d)})`)

  tRNAGroup.select("rect")
    .attr("height", 30)
    .attr("width", d => Math.abs(d.Stop - d.Start) / 10)
    .attr("fill", "gray")
    .attr("fill-opacity", 0.5)
    .style("stroke", "black").style("stroke-width", "1px")

  tRNAGroup.select("text.tRNALabel").text(d => d.AminoAcid)
    .attr("font-size", "9")
    .style("text-anchor", "middle").style("fill", "black")
    .attr("x", d => ((Math.abs(d.Stop - d.Start) / 2) / 10))
    .attr("y", -5);

  let geneSelection = allPhages.selectAll(".geneGroup")
    .data(function (d, i) { return d.genes || []; }, d => d.geneID);

  geneSelection.exit().remove();

  let geneEnter = geneSelection.enter()
    .append("g").classed('geneGroup', true);

  let gene = geneEnter.merge(geneSelection);

  geneEnter.append("rect").classed("generect", true);
  geneEnter.append("text").classed("geneNameLabel", true);
  geneEnter.append("text").classed("functionLabel", true);
  geneEnter.append("text").classed("phamLabel", true);

  gene_group_x = function (d) {
    return d3.min([d.start, d.stop]) / 10;
  };
  gene_group_y = function (d) {
    if (d.direction == "forward") {
      if (d.name % 2 === 0) {
        return -70;
      }
      else { return -30; }
    }
    else if (d.direction == "reverse") {
      if (d.name % 2 === 0) {
        return 30;
      }
      else { return 70; }
    }
  };

  gene
    .attr("transform", function (d) { return "translate(" + gene_group_x(d) + "," + gene_group_y(d) + ")" });

  geneEnter.select("rect.generect")
    .attr("width", 0)
    .transition()
    .duration(1600)
    .attr("width", function (d) { return Math.abs(d.stop - d.start) / 10; });

  gene.select("rect.generect")
    .on("click", function (event, d) {
      var dataset = Session.get("currentDataset");
      // Initialize the dialog to empty strings and arrays, rather than showing old data while waiting for new
      selectedDomains = [];
      Session.set("selectedDomains", selectedDomains);
      selectedTMDomains = [];
      Session.set("selectedTMDomains", selectedTMDomains);
      selectedClusterMembers = [];
      Session.set('selectedClusterMembers', selectedClusterMembers);
      Session.set('selectedGeneNotes', "");
      Session.set('selectedGene', "");
      Session.set('selectedProtein', "");
      Session.set('selectedPham', d.phamName);
      Session.set("selectedGeneTitle", "");

      nodedata = d3.select(this).node().parentNode.parentNode.__data__;
      Session.set("selectedGeneTitle", nodedata.phagename + " gene " + d.name + " (" + d.start + " - " + d.stop + " )" + " | pham " + d.phamName);

      var phamWidth = 600;
      var phamHeight = 40;
      var phamAALength = Math.abs(d.stop - d.start) / 3.0;

      d3.select("#svgDomain")
        .attr("width", "100%")
        .attr("height", 100)
        .attr("viewBox", "0 0 650 100")
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("display", "block")
        .style("margin", "0 auto")
        .selectAll("*").remove();

      d3.select("#svgDomain")
        .append("g")
        .attr("class", "domainVis")
        .attr("transform", "translate(25, 25)")
        .append("rect") // 'gene' rect
        .attr("height", 50)
        .attr("width", 600)
        .attr("fill", d.phamColor)
        .attr("stroke", "black")
        .attr("stroke-width", 2);

      Meteor.call("get_domains_by_gene", d.geneID, dataset, function (error, selectedDomains) {
        Session.set('selectedDomains', selectedDomains);

        function numOfDomains() { return selectedDomains.length; }
        var numberOfDomains = numOfDomains();

        d3.select("#svgDomain .domainVis")
          .selectAll(".domainRects")
          .data(selectedDomains)
          .enter()
          .append("rect") // 'domain' rect
          .attr("height", 40)
          .attr("width", function (d) { return (Math.abs(d.query_end - d.query_start) / phamAALength) * 600; })
          .attr("fill", "#ffbd88")
          .attr("stroke", "black")
          .attr("stroke-width", 1)
          .attr("transform", function (d, i) { return "translate(" + (((d.query_start - 1) / phamAALength) * 600) + "," + 5 + ")"; })
          .on("mouseover", function (event, d) {
            d3.select(this).style("stroke", "black").style("stroke-width", "2");
            d3.select("#" + d.domainname + ".collapsible-header").style("font-weight", "bold")
          })
          .on("mouseout", function (event, d) {
            d3.select(this).style("stroke", "black").style("stroke-width", "1");
            d3.select("div#" + d.domainname + ".collapsible-header").style("font-weight", "normal")
          })
          .on("click", function (event, d) {
            d3.select("li#" + d.domainname).classed("active", !d3.select("li#" + d.domainname).classed("active"));
            if (d3.select("div#" + d.domainname).attr("class") === "active collapsible-header") {
              d3.select("div#" + d.domainname).classed("active collapsible-header", false);
              d3.select("div#" + d.domainname).classed("collapsible-header", true);
              d3.select("div#" + d.domainname + ".collapsible-body").style("display", "none")
            }
            else {
              d3.select("div#" + d.domainname).classed("collapsible-header", false);
              d3.select("div#" + d.domainname).classed("active collapsible-header", true);
              d3.select("div#" + d.domainname + ".collapsible-body").style("display", "block")
            }
          });
      });

      // TM Domains
      d3.select("#svgTMDomain")
        .attr("width", "100%")
        .attr("height", 100)
        .attr("viewBox", "0 0 650 100")
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("display", "block")
        .style("margin", "0 auto")
        .selectAll("*").remove();

      d3.select("#svgTMDomain")
        .append("g")
        .attr("class", "domainVis")
        .attr("transform", "translate(25, 25)")
        .append("rect") // 'gene' rect
        .attr("height", 50)
        .attr("width", 600)
        .attr("fill", d.phamColor)
        .attr("stroke", "black")
        .attr("stroke-width", 2);
      Meteor.call("get_tm_domains_by_gene", d.geneID, dataset, function (error, selectedTMDomains) {
        Session.set('selectedTMDomains', selectedTMDomains);

        function numOfTMDomains() { return selectedTMDomains.length; }
        var numberOfTMDomains = numOfTMDomains();

        d3.select("#svgTMDomain .domainVis")
          .selectAll(".TMdomainRects")
          .data(selectedTMDomains)
          .enter()
          .append("rect") // 'domain' rect
          .attr("height", 40)
          .attr("width", function (d) { return (Math.abs(d.query_end - d.query_start) / phamAALength) * 600; })
          .attr("fill", "dodgerblue")
          .attr("stroke", "black")
          .attr("stroke-width", 1)
          .attr("transform", function (d, i) { return "translate(" + (((d.query_start - 1) / phamAALength) * 600) + "," + 5 + ")"; })
          .on("mouseover", function (event, d) {
            d3.select(this).style("stroke", "black").style("stroke-width", "2");
            d3.select("#tm-domain-" + d._id._str + ".collapsible-header").style("font-weight", "bold")
          })
          .on("mouseout", function (event, d) {
            d3.select(this).style("stroke", "black").style("stroke-width", "1");
            d3.select("div#tm-domain-" + d._id._str + ".collapsible-header").style("font-weight", "normal")
          })
          .on("click", function (event, d) {
            d3.select("li#tm-domain-" + d._id._str).classed("active", !d3.select("li#tm-domain-" + d._id._str).classed("active"));
            if (d3.select("div#tm-domain-" + d._id._str).attr("class") === "active collapsible-header") {
              d3.select("div#tm-domain-" + d._id._str).classed("active collapsible-header", false);
              d3.select("div#tm-domain-" + d._id._str).classed("collapsible-header", true);
              d3.select("div#tm-domain-" + d._id._str + ".collapsible-body").style("display", "none")
            }
            else {
              d3.select("div#tm-domain-" + d._id._str).classed("collapsible-header", false);
              d3.select("div#tm-domain-" + d._id._str).classed("active collapsible-header", true);
              d3.select("div#tm-domain-" + d._id._str + ".collapsible-body").style("display", "block")
            }
          });
      });

      // End TM Domains

      Meteor.call("get_clusters_by_pham", Session.get('currentDataset'), d.phamName, function (error, selectedClusterMembers) {
        Session.set('selectedClusterMembers', selectedClusterMembers);
        uniqueClusters = _.uniq(selectedClusterMembers);
        Session.set('selectedClusters', uniqueClusters);
      });
      Meteor.subscribe('proteinSeq', nodedata.phagename, {
        onReady: function () {
          Session.set('selectedProtein', ">" + nodedata.phagename + " gp" + d.name + "\n" + d.translation);
        }
      });

      var genomeRecord = Genomes.findOne({ phagename: nodedata.phagename }, { fields: { sequence: 1 } });
      const g = genomeRecord ? genomeRecord.sequence : "";
      
      Session.set('selectedGeneNotes', d.genefunction);
      if (g) {
        if (d.direction === "forward") {
          Session.set('selectedGene', ">" + nodedata.phagename + " gene " + d.name + "\n" + g.slice(d.start - 1, d.stop));
        }
        else {
          complementSeq = g.slice(d.stop - 1, d.start).split('').reverse().map(complement).join('');
          Session.set('selectedGene', ">" + nodedata.phagename + " gene " + d.name + "\n" + complementSeq);
        }
      } else {
        Session.set('selectedGene', ">" + nodedata.phagename + " gene " + d.name + "\n[Sequence loading...]");
      }

      var onModalClose = function () {
        d3.selectAll("g.domainVis").remove();
      };

      $('ul.tabs').tabs();
      $('#geneData').modal('open');
      $('#geneData')[0].M_Modal.options.complete = onModalClose;

    })
    .attr("height", function (d) { return 30; })
    .style("stroke", "black").style("stroke-width", "1px")
    .attr("id", function (d) {
      return d.geneID
    })

    .style("stroke-width", "1px")
    .attr("fill", function (d) {
      if (Session.get("colorByPhams") === true) {
        return d.phamColor
      }
      else if (Session.get("colorByPhamAbundance") === true) {
        phamSize = phamsObj[+d.phamName];

        scaledAbundance = phamSize / maxPham;
        return ("hsl(0.66,0%," + (1 - (scaledAbundance)) * 100 + "%)");

      }
      else if (Session.get("colorByConservedDomains") === true) {
        return (d.domainCount > 0) ? "orange" : "white"
      }
      else if (Session.get("colorByTMDomains") === true) {
        return (d.tmDomainCount > 0) ? "dodgerblue" : "white"
      }
    })
    .attr("width", function (d) { return Math.abs(d.stop - d.start) / 10; });

  gene.select("text.geneNameLabel")
    .attr("x", function (d) { return (Math.abs(d.stop - d.start) / 2) / 10; })
    .attr("y", function (d) {
      if (d.direction == "forward") {
        if (d.name % 2 === 0) { // forward and even
          return 20;
        }
        else { return 20; } // forward and odd
      }
      else if (d.direction == "reverse") {
        if (d.name % 2 === 0) { // reverse and even
          return 20;
        }
        else { return 20; } //reverse and odd
      }
    })
    .style("text-anchor", "middle").style("fill", "black")
    .text(function (d) { return d.name })

    .attr("opacity", 1);

  gene.select("text.functionLabel")
    .attr("x", function (d) { return (Math.abs(d.stop - d.start) / 2) / 10; })
    .attr("y", function (d) {
      if (d.direction == "forward") {
        if (d.stop - d.start < 500) {
          return -65;
        }
        else { return -45; }
      }
      else if (d.direction == "reverse") {
        if (d.stop - d.start < 500) {
          return 125;
        }
        else { return 85; }
      }
    })
    .style("text-anchor", "middle").style("fill", "black")
    .attr("font-size", "11px")
    .text(function (d) { return d.genefunction; })

    .attr("opacity", function (d) {
      if (Session.get("showFunctionLabels") === true) { return 1; }
      else { return 0; }
    });

  gene.select("text.phamLabel")
    .style("fill", "black")
    .attr("font-size", "9")
    .attr("x", function (d) { return (Math.abs(d.stop - d.start) / 2) / 10; })
    .attr("y", function (d) {
      if (d.direction == "forward") {
        if (d.name % 2 === 0) { // forward and even
          return -10;
        }
        else { return -10; } // forward and odd
      }
      else if (d.direction == "reverse") {
        if (d.name % 2 === 0) { // reverse and even
          return 50;
        }
        else { return 50; } //reverse and odd
      }
    })
    .attr("text-anchor", function (d) {
      if (Math.abs(d.stop - d.start) < 500 && d.direction === "forward") {
        return "start";
      }
      else if (Math.abs(d.stop - d.start) < 500 && d.direction === "reverse") {
        return "end";
      }
      else {
        return "middle";
      }
    })
    .attr("transform", function (d) {
      if (Math.abs(d.stop - d.start) < 500 && d.direction === "forward") {
        return "rotate(-90," + (3 + (Math.abs(d.stop - d.start)) / 2 / 10) + ",-10)";
      }
      else if (Math.abs(d.stop - d.start) < 500 && d.direction === "reverse") {
        return "rotate(-90," + (2.75 + Math.abs(d.stop - d.start) / 2 / 10) + ",50)";
      }
      else {
        return "rotate(0)";
      }
    })

    .text(function (d) {
      phamSize = phamsObj ? phamsObj[+d.phamName] : undefined;
      return d.phamName + (phamSize !== undefined ? " (" + phamSize + ")" : "");
    })
    .attr("opacity", function (d) {
      if (Session.get("showPhamLabels") === true) { return 1; }
      else { return 0; }
    });

  phage.exit().remove();


  phagesdata = svgMap.selectAll(".phages").data();
  phagesdata.forEach((d, i) => { d.ypos = (i * 300) + 150; });
  var hspGroupData = svgMap.selectAll(".hspGroup").data();

  var genome_pairs = [];
  phagesdata.forEach(function (d, i) {
    var c = phagesdata[i - 1];
    if (c && d) {
      genome_pairs.push({ query: c.phagename, subject: d.phagename });
      if (c.sequence && d.sequence && alignedGenomes.find({ query: c.phagename, subject: d.phagename }).count() === 0) {
        blast(c, d);
      }
      else {
      }
    }

  });

  tempAlign = alignedGenomes.find().fetch();
  tempAlign.diff(genome_pairs).forEach(function (v, i, a) {

    hspData = hspData.filter(function (e, j, b) {
      return !((e.queryName === v.query) && (e.subjectName === v.subject));
    });

    alignedGenomes.remove({ query: v.query, subject: v.subject });
  });

  // Calculate the actual bounding box of all rendered SVG elements and adjust canvas height
  // This perfectly prevents rotated gene labels from being clipped at the bottom of the map
  setTimeout(function() {
    // Set the stable floor immediately
    adjust_map_height(false);
    if (!isTransitioning) {
        update_hsps(hspData);
    }
    // Defer the expensive and potentially unstable getBBox call until after transitions
    setTimeout(() => adjust_map_height(true), 1700);
  }, 0);
}

Template.phages.onCreated(function () {
  Session.set("clusters", []);
  Session.set("clustersExpanded", false);
  Session.set("showFunctionLabels", true);
  Session.set("showPhamLabels", true);
  Session.set("showhspGroups", true);
  Session.set("colorByPhamAbundance", false);
  Session.set("colorByConservedDomains", false)
  Session.set("colorByTMDomains", false)
  Session.set("colorByPhams", true)
  // Centralized currentDataset initialization was moved to layout.js to prevent "Actino_Draft" silent overwrites

  Meteor.call('getlargestphamsize', function (error, result) {
    if (typeof error !== 'undefined') {
    }
    else {
      maxPham = result;
    }
  });

  let lastDataset = null;
  Tracker.autorun(() => {
    const dataset = Session.get("currentDataset");
    if (!dataset || dataset === lastDataset) return; // Only fire on actual dataset change
    lastDataset = dataset;

    // Clear local collections when dataset changes to prevent stale data
    genomesWithSeqHandlers.forEach(h => h.stop());
    genomesWithSeqHandlers = [];
    selectedGenomes.remove({});
    alignedGenomes.remove({});
    hspData = [];
    if (typeof mapGroup !== 'undefined') {
      if (typeof update_phages === 'function') update_phages();
      if (typeof update_hsps === 'function') update_hsps([]);
    }

    Meteor.call('getclusters', dataset, function (error, result) {
      if (typeof error !== 'undefined') {
        console.error('Error getting clusters:', error);
      } else {
        Session.set('clusters', result);
      }
    });

    Meteor.call('getphams', dataset, function (error, result) {
      if (typeof error !== 'undefined') {
        console.error('Error getting phams:', error);
        alert('error getting phams:', error)
      } else {
        Session.set('phamsObj', result);
        phamsObj = result;
      }
    });
  });


});

var tooltip = d3.select("body")
  .append("div")
  .style("z-index", "10")
  .style("visibility", "hidden")
  .style("background", "lightcyan")
  .style("width", "150px")
  .style("height", "50px")
  .style("text-align", "center")
  .style("position", "absolute")
  .style("padding", "2px")
  .style("font-family", "Arial")
  .style("border-radius", "8px");

//in rendered callback

blast = function (q, d) {
  blastAlignmentsOutstanding = blastAlignmentsOutstanding + 1;

  var query = q;
  var subject = d;
  alignedGenomes.update({ "query": query.phagename, "subject": subject.phagename }, { "query": query.phagename, "subject": subject.phagename }, { upsert: true });

  var s1 = query.sequence;
  var s2 = subject.sequence;

  if (!s1 || !s2) {
    console.error("BLAST error: missing sequence for " + (s1 ? "" : query.phagename) + (s1 || s2 ? "" : " and ") + (s2 ? "" : subject.phagename));
    blastAlignmentsOutstanding = blastAlignmentsOutstanding - 1;
    // Do not remove from alignedGenomes to prevent infinite reactive loop
    if (blastAlignmentsOutstanding === 0) {
      window.requestAnimationFrame(function () {
        $(".restoring-your-work-toast").fadeOut();
        setTimeout(function() { update_hsps(hspData); }, 0);
      });
    }
    return;
  }

  // Always use the production proxy path, as Caddy handles /blastalign on all environments
  myURL = "/blastalign";

  console.log("Attempting BLAST alignment between " + query.phagename + " and " + subject.phagename);

  $.ajax({
    type: "POST",
    method: "POST",
    url: myURL,
    data: { seq1: s1, seq2: s2, name1: query.phagename, name2: subject.phagename },
    dataType: 'json',
    jsonp: false,
    success: function (data) {
      blastAlignmentsOutstanding = blastAlignmentsOutstanding - 1;
      drawBlastAlignments(blastAlignmentsOutstanding, data);
    },
    error: function (jqXHR, textStatus, errorThrown) {
      console.error("BLAST failure for " + query.phagename + " vs " + subject.phagename + ":", textStatus, errorThrown, jqXHR.responseText);
      blastAlignmentsOutstanding = blastAlignmentsOutstanding - 1;
      // Do not remove from alignedGenomes to prevent infinite reactive loop
      if (blastAlignmentsOutstanding === 0) {
        window.requestAnimationFrame(function () {
          $(".restoring-your-work-toast").fadeOut();
          setTimeout(function() { update_hsps(hspData); }, 0);
          });
      }
    }
  });
};

drawBlastAlignments = function (blastAlignmentsOutstanding, json) {

  var parseBlastResult = function (queryName, subjectName, hspsArray) {
    if (queryName === "" || subjectName === "") { return; }

    // If the user deselected either genome while the BLAST alignment was fetching,
    // abort adding the stale alignment data to the map.
    if (alignedGenomes.find({ query: queryName, subject: subjectName }).count() === 0) {
      return;
    }

    var genome_pair_hsps = [];
    hspsArray.forEach(function (value, index, myArray) {
      var hspCoordinates = Array();
      hspCoordinates.push({ x: value.query_from / 10, y: 0, evalue: value.evalue, identity: value.identity, align_len: value.align_len });
      hspCoordinates.push({ x: value.query_to / 10, y: 0 });
      hspCoordinates.push({ x: value.hit_to / 10, y: 270 });
      hspCoordinates.push({ x: value.hit_from / 10, y: 270 });
      genome_pair_hsps.push(hspCoordinates);
    });
    genome_pair_hsps.sort(function (a, b) {
      return a[0].align_len - b[0].align_len;
    });
    hspData.push({ queryName: queryName, subjectName: subjectName, genome_pair_hsps: genome_pair_hsps });
  };

  var blasthsps = [];
  var queryName = "";
  var subjectName = "";

  if (json &&
    json.BlastOutput2 &&
    json.BlastOutput2.report &&
    json.BlastOutput2.report.results &&
    json.BlastOutput2.report.results.bl2seq[0] &&
    json.BlastOutput2.report.results.bl2seq[0].hits[0] &&
    json.BlastOutput2.report.results.bl2seq[0].hits[0].hsps) {
    blasthsps = json.BlastOutput2.report.results.bl2seq[0].hits[0].hsps;
    queryName = json.BlastOutput2.report.results.bl2seq[0].query_title;
    subjectName = json.BlastOutput2.report.results.bl2seq[0].hits[0].description[0].title;
  }
  else {
  }

  parseBlastResult(queryName, subjectName, blasthsps);

      // If we are currently transitioning genomes, don't trigger an HSP update yet
      // The on("end") handler will trigger it at the right time.
      if (!isTransitioning) {
        setTimeout(() => update_hsps(hspData), 0);
      }
  else {

    i = 0;
    animate();
    function animate() {
      i == 0 && requestAnimationFrame(animate);
      i++;
    }
  }
};

Template.phages.onDestroyed(function () {
  Session.set('expandAllClusters', false);
  $(document).ready(function () {
    $('#mapSettings').remove();
    $('#geneData').remove();
  });

});

Template.phages.onRendered(function () {

  Tracker.autorun(function () {
    Meteor.subscribe('genomes', Session.get("currentDataset"))
  })
  $("#preloader").fadeOut(300).hide();
  $(document).ready(function () {
    $('ul.tabs').tabs();

    $('#mapSettings').modal();
    $('#geneData').modal();
    $('#geneData').modal();

    // Initialize FAB once on render
    $('.fixed-action-btn').floatingActionButton({ direction: 'left' });

    // Watch for data loading to update button state
    Tracker.autorun(function () {
      Session.get('clusters'); // Dependency
      Tracker.afterFlush(function () {
        updateCollapsibleState();
      });
    });

    $('.collapsible').collapsible({
      accordion: false, // A setting that changes the collapsible behavior to expandable instead of the default accordion style
      onOpenEnd: function () {
        updateCollapsibleState();
      },
      onCloseEnd: function () {
        updateCollapsibleState();
      }
    });
    $(document).on("keydown", function (event) {
      if (event.which === 16) {
        d3.selectAll(".phagename").classed("horizontalAlign", true);
      }
    });
    $(document).on("keyup", function (event) {
      if (event.which === 16) {
        d3.selectAll(".phagename").classed("horizontalAlign", false);
      }
    });
  });
  //Renamed svg to svgMap to distinguish genome map svg canvas from other canvases

  svgMap = d3.select("#svg-genome-map");
  svgMap.attr("border", "50px")
    .attr("overflow", "visible");

  mapGroup = svgMap.append("g").attr("id", "mapGroup");

  // Access Domain Visual SVG canvas and add to it
  svgDomain = d3.select("#svgDomain");
  svgDomain.attr("display", "block")
    .attr("margin", "auto")
    .attr("viewBox", "0 0 650 100")
    .attr("preserveAspectRatio", "xMinYMin meet");

  svgTMDomain = d3.select("#svgTMDomain");
  svgTMDomain.attr("display", "block")
    .attr("margin", "auto")
    .attr("viewBox", "0 0 650 100")
    .attr("preserveAspectRatio", "xMinYMin meet");

  Tracker.autorun(function () {
    Session.get('phamsObj'); // Dependency to trigger redraw when phams load
    update_phages();
    update_hsps(hspData);

  });
  document.getElementById("viewMapTab").addEventListener("click", viewMapTabClicked, false);

  const genomeMapContainer = document.getElementById("genome-map");
  if (genomeMapContainer) {
    genomeMapContainer.addEventListener('scroll', function (e) {
      last_known_scroll_position = e.target.scrollLeft;

      if (!ticking) {
        window.requestAnimationFrame(function () {
          updateStickyLabels(last_known_scroll_position);
          ticking = false;
        });
        ticking = true;
      }
    });
  }
});

Template.cluster.onRendered(function () {
  $('.collapsible').collapsible({
    accordion: false, // A setting that changes the collapsible behavior to expandable instead of the default accordion style
    onOpenEnd: function () {
      updateCollapsibleState();
    },
    onCloseEnd: function () {
      updateCollapsibleState();
    }
  });

  $('li').find('.dont-collapse').unbind('click.collapse');
  $('li').find('.dont-collapse').on('click.collapse', function (e) {
    e.stopPropagation();
    $(e.target).trigger('favorites-click');
  });
});

updateCollapsibleState = function () {
  var total = $('#cluster-list > li').length;
  var active = $('#cluster-list > li.active').length;
  Session.set('anyClustersOpen', active > 0);
  Session.set('anyClustersClosed', active < total);
};



Template.phages.helpers({
  clusters: function () {
    return Session.get('clusters');
  },
  domainQuery: function () { return "https://www.ncbi.nlm.nih.gov/Structure/cdd/cddsrv.cgi?uid=" },
  selectedDomains: function () { return Session.get('selectedDomains') },
  selectedTMDomains: function () {
    return Session.get('selectedTMDomains')?.map(d => {
      d.id = "tm-domain-" + d._id._str
      d.DomainID = +d.DomainID
      return d
    })
      .sort((a, b) => a.DomainID - b.DomainID)
  },
  newFeature: function () {
    const user = Meteor.user();
    if (user && user.featureDiscovery) {
      if (user.featureDiscovery.length > 0) {
        return "pulse";
      }
    }
  },
  geneTranslation: function () { return Session.get('geneTranslation'); },
  phamAbundanceFD: function () { return Session.get('phamAbundanceFD'); },
  selectedGenomes: selectedGenomes,
  selectedGeneTitle: function () { return Session.get('selectedGeneTitle') },
  selectedPham: function () { return Session.get('selectedPham'); },
  selectedGene: function () { return Session.get('selectedGene'); },
  selectedGeneNotes: function () { return Session.get('selectedGeneNotes'); },
  selectedProtein: function () { return Session.get('selectedProtein'); },
  selectedClusters: function () { return Session.get('selectedClusters'); },
  schemaVersionMin11: function () {
    let dataset = Datasets.findOne({ name: Session.get('currentDataset') })
    return dataset && dataset["schema version"] >= 11;
  },
  genomes_are_selected: function () {
    return selectedGenomes.find({}).fetch().length > 0;
  },
  clusters_expanded: function () {
    return Session.get("clustersExpanded");
  },
  any_clusters_open: function () {
    return Session.get("anyClustersOpen");
  },
  any_clusters_closed: function () {
    return Session.get("anyClustersClosed");
  },
  class_if_clusters_open: function () {
    return Session.get("anyClustersOpen") ? "" : "hide";
  },
  class_if_clusters_closed: function () {
    return Session.get("anyClustersClosed") ? "" : "hide";
  },
  class_if_genomes_selected: function () {
    return selectedGenomes.find().count() > 0 ? "" : "hide";
  },
});

let session_tRNAsHandler = false;

Template.phages.events({
  "change .clusterCheckbox": function (event, template) {
    let clusterAttr = event.target.getAttribute("data-cluster");
    let sc = event.target.getAttribute("data-subcluster");
    if (sc !== "" && !isNaN(Number(sc))) {
      sc = Number(sc);
    }

    $("#preloader").show(function () {
      let clusterPhages = [];
      const clusters = Session.get('clusters');
      if (clusters) {
        const found = clusters.find(c => c.cluster === clusterAttr && c.subcluster === sc);
        if (found) clusterPhages = found.phages;
      }

      const dataset = Session.get('currentDataset');
      const clusterPhageNames = clusterPhages.map(function (obj) { return obj.phagename });

      if (event.target.checked) {
        // 1. Update local state INSTANTLY for immediate UI feedback
        clusterPhages.forEach(p => {
          selectedGenomes.upsert({ phagename: p.phagename }, {
            _id: p._id,
            phageID: p.phageID,
            phagename: p.phagename,
            genomelength: p.genomelength,
            cluster: p.cluster,
            subcluster: p.subcluster
          });
        });

        // 2. Trigger redraw for the "frame"
        update_phages();

        // 3. Start high-bandwidth sequence subscriptions in parallel
        const handler = Meteor.subscribe("genomesWithSeq", dataset, clusterPhageNames, {
          onReady: function () {
            update_phages(); // Redraw on sequence arrival
          }
        });
        genomesWithSeqHandlers.push(handler);

        // 4. Update tRNA/Gene support
        const selectedPhageNames = selectedGenomes.find({}, { phagename: 1 }).fetch().map(d => d.phagename)
        const new_session_tRNAsHandler = Meteor.subscribe("selected_tRNAs", dataset, selectedPhageNames, {
          onReady: () => update_phages()
        });

        if (session_tRNAsHandler) {
          session_tRNAsHandler.stop()
        }
        session_tRNAsHandler = new_session_tRNAsHandler;
      }
      else {
        // Cluster Unchecked: Immediate local removal
        clusterPhageNames.forEach(function (phagename) {
          hspData = hspData.filter(function (e, i, a) {
            return !((e.queryName === phagename) || (e.subjectName === phagename));
          });
          selectedGenomes.remove({ phagename: phagename });
          alignedGenomes.remove({ query: phagename });
          alignedGenomes.remove({ subject: phagename });
        });

        window.requestAnimationFrame(function () {
          update_hsps(hspData);
        });

        const selectedPhageNames = selectedGenomes.find({}, { phagename: 1 }).fetch().map(d => d.phagename)
        const new_session_tRNAsHandler = Meteor.subscribe("selected_tRNAs", dataset, selectedPhageNames, {
          onReady: () => update_phages()
        });

        if (session_tRNAsHandler) {
          session_tRNAsHandler.stop()
        }
        session_tRNAsHandler = new_session_tRNAsHandler;
        update_phages();
      }
    });
  },
  "change .phageCheckbox": function (event, template) {
    $("#preloader").show(function () {
      const phagename = event.target.id;
      const dataset = Session.get('currentDataset');

      if (event.target.checked) {
        let p;
        const clusters = Session.get('clusters');
        if (clusters) {
          for (const c of clusters) {
            p = c.phages.find(ph => ph.phagename === phagename);
            if (p) break;
          }
        }

        if (p) {
          // 1. Instant local update
          selectedGenomes.upsert({ phagename: p.phagename }, {
            _id: p._id,
            phageID: p.phageID,
            phagename: p.phagename,
            genomelength: p.genomelength,
            cluster: p.cluster,
            subcluster: p.subcluster
          });
          update_phages();

          // 2. Fetch sequence in background
          const handler = Meteor.subscribe("genomesWithSeq", dataset, [phagename], {
            onReady: function () {
              update_phages();
            }
          });
          genomesWithSeqHandlers.push(handler);

          // 3. Support data
          const selectedPhageNames = selectedGenomes.find({}, { phagename: 1 }).fetch().map(d => d.phagename)
          const new_session_tRNAsHandler = Meteor.subscribe("selected_tRNAs", dataset, selectedPhageNames, {
            onReady: () => {
              update_phages()
              update_hsps(hspData)
            }
          });

          if (session_tRNAsHandler) {
            session_tRNAsHandler.stop()
          }
          session_tRNAsHandler = new_session_tRNAsHandler;
        }
      }
      else {
        // ... (uncheck logic)
        hspData = hspData.filter(function (e, i, a) {
          return !((e.queryName === phagename) || (e.subjectName === phagename));
        });
        window.requestAnimationFrame(function () {
          update_hsps(hspData);
        });
        selectedGenomes.remove({ "phagename": phagename });
        alignedGenomes.remove({ query: phagename });
        alignedGenomes.remove({ subject: phagename });
        
        const selectedPhageNames = selectedGenomes.find({}, { phagename: 1 }).fetch().map(d => d.phagename)
        const new_session_tRNAsHandler = Meteor.subscribe("selected_tRNAs", dataset, selectedPhageNames, {
          onReady: () => {
            update_phages()
            update_hsps(hspData)
          }
        });

        if (session_tRNAsHandler) {
          session_tRNAsHandler.stop()
        }
        session_tRNAsHandler = new_session_tRNAsHandler;
        update_phages();
      }
    });
  },

  "favorites-click": function (event, template) {
    // Deprecated favorites system. UI logic preserved for feedback but persistence removed.
    var fav = d3.select("#" + event.target.id);
    if (!fav.classed("favorite")) {
      fav.classed("favorite", true);
      fav.classed("yellow-text", true);
      fav.classed("grey-text", false);
    }
    else {
      fav.classed("favorite", false);
      fav.classed("yellow-text", false);
      fav.classed("grey-text", true);
    }
  },

  "click .downloadGenomeMap": function (event, template) {
    d3.selectAll('text.phagename').attr('transform', function () {
      return 'translate(' + 0 + ', -120)';
    });

    $("svg").attr({ version: '1.1', xmlns: "http://www.w3.org/2000/svg" });
    var svgData = $("#svg-genome-map")[0].outerHTML;
    var svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    var svgUrl = URL.createObjectURL(svgBlob);
    var downloadLink = document.createElement("a");
    downloadLink.href = svgUrl;
    downloadLink.download = "phamerator_map.svg";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  },

  "click .mapSettings": function (event, template) {
    event.preventDefault();

    $('#mapSettings').modal('open');
  },

  "change #functionLabelsSwitch": function (event, template) {
    event.preventDefault();
    setTimeout(function () { Session.set("showFunctionLabels", event.target.checked) }, 200);
  },

  "change #phamLabelsSwitch": function (event, template) {
    event.preventDefault();
    setTimeout(function () { Session.set("showPhamLabels", event.target.checked) }, 200);
  },
  "change #phamAbundanceRadioButton": function (event, template) {
    event.preventDefault();
    setTimeout(function () {
      Session.set("colorByConservedDomains", false);
      Session.set("colorByTMDomains", false);
      Session.set("colorByPhams", false);
      Session.set("colorByPhamAbundance", true);
    }, 200);
  },
  "change #conservedDomainRadioButton": function (event, template) {
    event.preventDefault();
    setTimeout(function () {
      Session.set("colorByPhamAbundance", false);
      Session.set("colorByConservedDomains", true);
      Session.set("colorByTMDomains", false);
      Session.set("colorByPhams", false);
    }, 200);
  },
  "change #TMDomainRadioButton": function (event, template) {
    event.preventDefault();
    setTimeout(function () {
      Session.set("colorByPhamAbundance", false);
      Session.set("colorByConservedDomains", false);
      Session.set("colorByTMDomains", true);
      Session.set("colorByPhams", false);
    }, 200);
  },
  "change #phamColorRadioButton": function (event, template) {
    event.preventDefault();
    setTimeout(function () {
      Session.set("colorByPhamAbundance", false);
      Session.set("colorByConservedDomains", false);
      Session.set("colorByTMDomains", false);
      Session.set("colorByPhams", true);
    }, 200);
  },

  "change #hspGroupsSwitch": function (event, template) {
    event.preventDefault();
    setTimeout(function () {
      Session.set("showhspGroups", event.target.checked);

      d3.selectAll(".hsp")
        .style("visibility", function () { return "visible"; })
        .transition()
        .delay(250)
        .duration(2000)
        .style("opacity", function () {
          if (Session.get("showhspGroups") === true) {
            return 0.3;
          }
          else {
            return 0;
          }
        })
        .transition().delay(2000)
        .style("visibility", function () {
          if (Session.get("showhspGroups") === true) {
            return "visible";
          }
          else {
            return "hidden";
          }
        });
    }, 200);
  },

  "click #clearSelection": function (event, template) {
    var instance = M.FloatingActionButton.getInstance($('.fixed-action-btn')[0]);
    if (instance) instance.close();
    if (session_tRNAsHandler) {
      session_tRNAsHandler.stop();
    }

    d3.select("#clearSelection").style("opacity", 0);

    selectedGenomes.remove({});
    alignedGenomes.remove({});
    hspData = [];
    var dataset = Session.get('currentDataset');


    svgMap.selectAll(".hspGroup").remove();
  },
  "click #expand_all": function (event, template) {
    var instance = M.FloatingActionButton.getInstance($('.fixed-action-btn')[0]);
    if (instance) instance.close();

    Session.set('expandAllClusters', true);

    $("#cluster-list > li").addClass("active");
    $("#cluster-list .collapsible-header").addClass("active");
    $("#cluster-list .collapsible-body").show();
    $("#cluster-list").collapsible('destroy');
    $("#cluster-list").collapsible({
      accordion: false,
      onOpenEnd: function () { updateCollapsibleState(); },
      onCloseEnd: function () { updateCollapsibleState(); }
    });
    // Session.set("clustersExpanded", true); // handled by updateCollapsibleState
    updateCollapsibleState();
  },
  "click #scroll_top": function (event, template) {
    var instance = M.FloatingActionButton.getInstance($('.fixed-action-btn')[0]);
    if (instance) instance.close();
    $("html, body").animate({ scrollTop: 0 }, "slow");
  },

  "click #collapse_all": function (event, template) {
    var instance = M.FloatingActionButton.getInstance($('.fixed-action-btn')[0]);
    if (instance) instance.close();

    Session.set('expandAllClusters', false);

    $("#cluster-list > li").removeClass("active");
    $("#cluster-list .collapsible-header").removeClass("active");
    $("#cluster-list .collapsible-body").hide();
    $("#cluster-list").collapsible('destroy');
    $("#cluster-list").collapsible({
      accordion: false,
      onOpenEnd: function () { updateCollapsibleState(); },
      onCloseEnd: function () { updateCollapsibleState(); }
    });
    // Session.set("clustersExpanded", false); // handled by updateCollapsibleState
    updateCollapsibleState();

    $("html, body").animate({ scrollTop: 0 }, "slow");

  }
});

Template.registerHelper('clusterIsChecked', function (phagesByHelper) {
  if (!phagesByHelper || !Array.isArray(phagesByHelper)) return false;
  
  let r = true;
  phagesByHelper.forEach(function (phage) {
    if (selectedGenomes.find({ "phagename": phage.phagename }).count() == 0) {
      r = false;
    }
  });
  return r;
});

Template.registerHelper('phageIsChecked', function (input) {
  return selectedGenomes.find({ "phagename": input }).count() > 0;
});

Template.cluster.onCreated(function() {
  this.renderPhages = new ReactiveVar(false);
});

Template.cluster.events({
  'click .collapsible-header': function(event, template) {
    template.renderPhages.set(true);
  }
});

Template.cluster.helpers({
  renderPhages: function() {
    return Template.instance().renderPhages.get() || Session.get('expandAllClusters');
  },
  selectedCount: function () {
    // 'this' is the cluster object from the #each loop
    const cluster = this.cluster;
    const subcluster = this.subcluster;
    const count = selectedGenomes.find({ cluster: cluster, subcluster: subcluster }).count();
    return count === 0 ? "" : count;
  },
  selectedClass: function () {
    const cluster = this.cluster;
    const subcluster = this.subcluster;
    const count = selectedGenomes.find({ cluster: cluster, subcluster: subcluster }).count();
    return count === 0 ? "badge" : "purple new badge";
  },
  dataBadgeCaption: function () {
    const cluster = this.cluster;
    const subcluster = this.subcluster;
    const count = selectedGenomes.find({ cluster: cluster, subcluster: subcluster }).count();
    if (count === 0) return "";
    return count === 1 ? "selected genome" : "selected genomes";
  },
  favoriteSubcluster: function (cluster, subcluster) {
    // Deprecated favorites system.
    return "grey-text";
  }
});

Template.mapSettingsModal.helpers({
  schemaVersionMin11: function () {
    let dataset = Datasets.findOne({ name: Session.get('currentDataset') })
    return dataset && dataset["schema version"] >= 11;
  },
  'blastSwitchState': function () {
    return Session.get("showhspGroups");
  },
  'phamLabelsSwitchState': function () {
    return Session.get("showPhamLabels");
  },
  'functionLabelsSwitchState': function () {
    return Session.get("showFunctionLabels");
  },
  'phamAbundanceState': function () {
    return Session.get("colorByPhamAbundance");
  },
  'conservedDomainState': function () {
    return Session.get("colorByConservedDomains");
  },
  'TMDomainState': function () {
    return Session.get("colorByTMDomains")
  },
  'phamColorState': function () {
    return Session.get("colorByPhams");
  }

});
