import Clipboard from 'clipboard';
import d3 from 'd3';

var clipboard = new Clipboard('.btn-copy-link');
clipboard.on('success', function (e) {
  M.toast({ html: 'sequence copied!', displayLength: 1000 });
  e.clearSelection();
});

Template.phages.onCreated(function () {
  var self = this;
  self.autorun(function () {
    var dataset = Session.get('currentDataset');
    self.subscribe('genomes', dataset);
    self.subscribe('allUsers');
  });
});

genomesWithSeqHandlers = [];

let last_known_scroll_position = 0;
let ticking = false;

function doSomething(scroll_pos) {
  // Do something with the scroll position
  d3.selectAll('text.phagename').attr('transform', function () {
    return 'translate(' + scroll_pos + ', -120)';
  });
}

window.addEventListener('scroll', function (e) {
  last_known_scroll_position = window.scrollX;

  if (!ticking) {
    window.requestAnimationFrame(function () {
      doSomething(last_known_scroll_position);
      ticking = false;
    });

    ticking = true;
  }
});

adjust_skew_all = function () {
  var phages = d3.selectAll(".phages")
  phages.each(function (d) {
    adjust_skew(this);
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
    .style({
      top: function (d, i) {
        return 60 + ((i * 30)) + "px";
      }
    })
}

var colorsys = require('colorsys');
hspData = [];
var d3line2 = d3.svg.line()
  .x(function (d) {
    return d.x;
  })
  .y(function (d, i) {
    return (d.y);
  })
  .interpolate("linear-closed");

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
    .delay(1000)
    .duration(1000)
    .style("opacity", function () {
      if (Session.get("showhspGroups") === true) {
        return 0.3;
      }
      else {
        return 0;
      }
    });

  hspGroup.enter().insert("g", ":first-child")
    .classed("hspGroup", true)
    .attr("id", function (d) {

      i = 0;
      animate();
      function animate() {
        i == 0 && requestAnimationFrame(animate);
        Session.set("progressbarState", ((phagesdata.length - blastAlignmentsOutstanding) / phagesdata.length) * 100 + "%");
        i++;
      }

      return "phage_" + d.queryName.replace(/\./g, '_dot_').replace(/ /g, '_space_') + "___phage_" + d.subjectName.replace(/\./g, '_dot_').replace(/ /g, '_space_');
    })
    .each(function (d) {
      let queryName = d.queryName;
      let subjectName = d.subjectName;
      queryName = queryName.replace(/\./g, '_dot_').replace(/ /g, '_space_');
      subjectName = subjectName.replace(/\./g, '_dot_').replace(/ /g, '_space_');
      var hsps = svgMap.selectAll("g#phage_" + queryName + "___phage_" + subjectName + ".hspGroup")
        .selectAll(".hsp")
        .data(function (d) {
          return d.genome_pair_hsps;
        });
      hspsEnter = hsps.enter();
      hspsEnter
        .insert("svg:path", ":first-child")
        .classed("hsp", true)
        .on("mouseover", function (d) {
          d3.select(this).style({ "stroke": "black", "stroke-width": "2" });
          tooltip.html("e-value: " + d[0].evalue.toExponential(3) + "<br>" + d[0].identity + "/" + d[0].align_len + " (" + d3.format("0.000%")(d[0].identity / d[0].align_len) + ")");
          tooltip.style("left", (d3.event.pageX) + "px")
            .style("top", (d3.event.pageY + 50) + "px")
            .style("opacity", 0)
            .transition()
            .duration(250)
            .style("opacity", 1);
          return tooltip.style("visibility", "visible");
        })
        .style("stroke-width", 0)
        .attr("d", function (d) {
          return d3line2(d);
        })

        .style("fill", function (d) {
          evalue = d[0].evalue.toString();

          array1 = evalue.split('e');
          exp = array1[array1.length - 1];
          exp = Math.abs(+exp);
          if (exp == 0.0) { hue = 1.0; }
          else {
            hue = exp / 200.0;
          }
          hue = Math.min(hue, 0.75);

          hexcolor = colorsys.hsv_to_hex({ h: hue * 360, s: 100, v: 100 });
          return hexcolor;
        })
        .style("opacity", 0)
        .transition()
        .duration(1000)
        .delay(3000)

        .style("opacity", function () {
          if (Session.get("showhspGroups") === true) {
            return 0.3
          }
          else {
            return 0;
          }
        })
        .style("visibility", function () {
          if (Session.get("showhspGroups") === true) {
            return "visible";
          }
          else {
            return "hidden";
          }
        });
      hsps.on("mousemove", function () {
        if (d3.event.pageX < (d3.select("#svg-genome-map").attr("width") / 2)) {
          return tooltip.style("top", (d3.event.pageY + 20) + "px").style("left", (d3.event.pageX) + "px");
        }
        else {
          return tooltip.style("top", (d3.event.pageY + 20) + "px").style("left", (d3.event.pageX - 150) + "px");
        }
      })
        .on("mouseout", function () {
          d3.select(this).style("stroke-width", 0);
          tooltip
            .style("opacity", 0);
          return tooltip.style("visibility", "hidden");
        });
    });

  hspGroup
    .attr("transform", function (d) {
      let queryName = d.queryName;
      queryName = queryName.replace(/\./g, '_dot_').replace(/ /g, '_space_')

      if (d3.select('g#phage_' + queryName)[0][0] !== null) {
        var t = d3.transform(d3.select('g#phage_' + queryName).attr("transform")),
          x = 0;
        y = t.translate[1] + 30;
        return "translate(" + x + "," + y + ")";
      }
    });

  if (Session.get("showhspGroups") === true) {
    d3.selectAll(".hspGroup").transition().duration(1000).style("opacity", 1);
  }
  adjust_skew_all();
  $("#preloader").fadeOut(300).hide();

}
var phageArray = [];
var map_order = [];

function update_phages() {
  pnames = selectedGenomes.find({}, { sort: { phagename: 1 } }).fetch().map(function (obj) { return obj.phagename; });
  phages = Genomes.find({ phagename: { $in: pnames } }, { sort: { cluster: 1, subcluster: 1, phagename: 1 } });

  phageArray = phages.fetch();
  phageArray.forEach(p => {
    p.selector = p.phagename.replace(/\./g, '_dot_').replace(/ /g, '_space_');
    // Fetch genes from Genes collection
    p.genes = Genes.find({ genome: p._id }).fetch().map(g => {
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
        genefunction: g.genefunction || g.Notes || g.function || g.product || ""
      };
    });
  })

  phage = mapGroup.selectAll(".phages")
    .data(phageArray, function (d) {
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
        return (d.domainCount === 0) ? "white" : "orange"
      }
      else if (Session.get("colorByTMDomains") === true) {
        return (d.tmDomainCount === 0) ? "white" : "dodgerblue"
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

  svgMap.attr("height", function (d) { return (selectedGenomes.find().count() * 305) });

  var draggedGenome = d3.select(this);
  var minX = 0;
  var maxX = 0;
  var phages = d3.selectAll(".phages");
  phages.each(function (d) {
    var minX = Math.min(minX, d3.transform(d3.select(this).attr("transform")).translate[0]);
    var maxX = Math.max(maxX, d3.transform(d3.select(this).attr("transform")).translate[0] + (d.genomelength / 10));
  });
  svgMap.attr("width", function (d) {
    return (maxX - minX);
  })
    .attr("x", function (d) { return minX });

  // Define the div for the tooltip
  var div = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

  newPhages = phage.enter().append("g")
    .attr("id", function (d, i) { return "phage_" + d.selector.replace(/\./g, '_dot_').replace(/ /g, '_space_'); })
    .classed("phages", true);

  var minX = 0;
  var maxX = 0;
  var phages = d3.selectAll(".phages");
  phages.each(function (d) {
    minX = Math.min(minX, d3.transform(d3.select(this).attr("transform")).translate[0]);
    maxX = Math.max(maxX, d3.transform(d3.select(this).attr("transform")).translate[0] + (d.genomelength / 10));
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

      var ay = d3.transform(d3.select(aSelector).attr("transform")).translate[1];
      var by = d3.transform(d3.select(bSelector).attr("transform")).translate[1];

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
      if (!d) return "";
      let selector = 'g#phage_' + d.selector.replace(/\./g, '_dot_').replace(/ /g, '_space_');
      let node = d3.select(selector).node();
      if (!node) return "";

      return "translate(" + d3.transform(d3.select(selector).attr("transform")).translate[0]
        + "," + ((i * 300) + 150) + ")";
    });

  adjust_skew = function (genome) {
    if (!genome) return;

    var genomeSelection = d3.select(genome);
    if (!genomeSelection || !genomeSelection.node()) return;

    if (typeof d3.transform(genomeSelection.attr("transform")).translate[0] == undefined) {
      genomeSelection.attr("transform", "translate(0," + d3.transform(genomeSelection.attr("transform")).translate[1] + ")")
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
    if (hspGroupSubject.size() > 0) {
      hspSubjectPaths = hspGroupSubject.selectAll("path");

      // get the query of that subject (genome above this one)
      queryForThisSubjectName = hspGroupSubject[0][0].id.split("___")[0].replace(/\./g, '_dot_').replace(/ /g, '_space_');
      queryForThisSubjectSelection = d3.select("g#" + queryForThisSubjectName);
      // get the offset of the genome above
      if (queryForThisSubjectSelection && queryForThisSubjectSelection.node()) {
        queryForThisSubjectX = d3.transform(queryForThisSubjectSelection.attr("transform")).translate[0];
      } else {
        queryForThisSubjectName = null;
      }
    }

    // get the hspGroup whose query is this genome
    hspGroupQuery = d3.selectAll(".hspGroup").filter(function (d) {
      // get only those .hspGroup that have the dragged query

      return genome.id == "phage_" + d.queryName.replace(/\./g, '_dot_').replace(/ /g, '_space_')
    });
    if (hspGroupQuery.size() > 0) {
      hspQueryPaths = hspGroupQuery.selectAll("path");

      // get the subject of that query (genome below this one)
      subjectForThisQueryName = hspGroupQuery[0][0].id.split("___")[1].replace(/\./g, '_dot_').replace(/ /g, '_space_');
      subjectForThisQuerySelection = d3.select("g#" + subjectForThisQueryName);
      if (subjectForThisQuerySelection && subjectForThisQuerySelection.node()) {
        subjectForThisQueryX = d3.transform(subjectForThisQuerySelection.attr("transform")).translate[0];
      } else {
        subjectForThisQueryName = null;
      }
    }
    if (d3.event && d3.event.x != undefined) {
      if ((d3.event.x < svgMap.attr("x")) && d3.event.x < 0) {
        // dragging this genome off the left end, keep this genome still and drag everything else to the right instead
        d3.select("#mapGroup")
          .attr("transform", function (d, i) {
            // move the genome along the x axis
            return "translate(" + -d3.event.x + "," + 0 + ")";
          });
      }

      d3.select(genome)
        .attr("transform", function (d) {
          // move the genome along the x axis
          return "translate(" + d3.event.x + "," + d3.transform(d3.select(genome).attr("transform")).translate[1] + ")";
        });
    }

    // if there is an hspGroup below this genome...
    var x = d3.transform(d3.select(genome).attr("transform")).translate[0];
    if (d3.event && d3.event.x != undefined) {
      var x = d3.event.x;

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

  var drag = d3.behavior.drag()
    .origin(function (d, i) {
      return { x: d3.transform(d3.select(this).attr("transform")).translate[0], y: d3.transform(d3.select(this).attr("transform")).translate[1] };
    })

    .on("dragstart", function (d) {
      dragging = this;
      if (!d3.event.sourceEvent.shiftKey) {
        d3.selectAll(".hspGroup")
          .transition().delay(200).duration(500)
          .style("opacity", 0)
      }
    })
    .on("drag", function (d) {
      d.ypos = d3.transform(d3.select(this).attr("transform")).translate[1];

      if (d3.event.sourceEvent.shiftKey) {
        adjust_skew(dragging);
      }
      else {
        // vertical dragging
        d3.select(this)
          .attr("transform", function (d) {
            return "translate(" + d3.transform(d3.select(this).attr("transform")).translate[0] + "," + (d3.event.y) + ")";
          });
      }
    })
    .on("dragend", function (d) {
      dragging = null;
      // get all genomes and then get the transformed x position of the one farthest to the left
      update_phages();
      if (d3.event.sourceEvent.shiftKey) {
        adjust_skew_all();
      }

      else {
        d3.selectAll(".phages")
          .sort(function (a, b) {
            var ay = d3.transform(d3.select('g#phage_' + a.selector).attr("transform")).translate[1];
            var by = d3.transform(d3.select('g#phage_' + b.selector).attr("transform")).translate[1];
            return ay - by;
          })
          .transition().duration(1000)
          .attr("transform", function (d, i) {
            d.ypos = (i * 300) + 150;

            return "translate(" + d3.transform(d3.select(this).attr("transform")).translate[0] + "," + ((i * 300) + 150) + ")";
          });

        phagesdata = d3.selectAll(".phages").data();
        var hspGroupData = d3.selectAll(".hspGroup").data();

        var genome_pairs = [];

        phagesdata.forEach(function (d, i) {
          var c = phagesdata[i - 1];
          if (c && d) {
            genome_pairs.push({ query: c.phagename, subject: d.phagename });
            if (alignedGenomes.find({ query: c.phagename, subject: d.phagename }).count() === 0) {
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
        setTimeout(update_hsps, 1500, hspData);
      }
    });

  phagedata = phage.data();

  newPhageNames = newPhages.append("text");
  newPhageNames
    .classed("phagename", true)
    .attr('position', 'fixed')
    .attr("font-size", "24px")
    .attr("fill", "black")
    .style("text-anchor", "start")
    .attr("position", "fixed")
    .attr("transform", "translate(0,-120)")
    .text(function (d) {
      if (d.cluster === "" || d.cluster === "Singleton") {
        return d.phagename + " (Singleton)";
      }
      if (d.clusterSubcluster) {
        return d.phagename + " (" + d.clusterSubcluster + ")";
      }
      return d.phagename + " (" + d.cluster + d.subcluster + ")";
    })
    .attr({ "opacity": 1 });
  newPhages.call(drag);

  newPhages.append("rect") // background for ruler
    .attr({
      x: 0, y: 0, width: function (d) {
        return d.genomelength / 10;
      }, height: 30
    })
    .style({ "stroke-width": "2px", "fill": "white", "stroke": "black" })
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
    .style({ "fill": "black" })
    .attr({
      x: function (d) {
        return d / 10;
      }, y: 0, width: "1px", height: 30
    })
    .attr({ "opacity": 0 })
    .transition().duration(1500)
    .attr({ "opacity": 1 });

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
    .attr({ "opacity": 0 })
    .transition().duration(1500)
    .attr({ "opacity": 1 });
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
    .style({ "fill": "black" })
    .attr({
      x: function (d) {
        return d / 10;
      }, y: 0, width: "1px", height: 15
    })
    .attr({ "opacity": 0 })
    .transition().duration(1500)
    .attr({ "opacity": 1 });
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
    .style({ "fill": "black" })
    .attr({
      x: function (d) {
        return d / 10;
      }, y: 15, width: "1px", height: 15
    })
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

  let tRNAGroup = phages.selectAll(".tRNAGroup")
    .data(function (d) {

      return TRNAs.find({ PhageID: d.phageID }).fetch()
    }, d => d.GeneID)
    .enter()
    .append("g").classed('tRNAGroup', true);

  tRNAGroup.attr('transform', d => `translate(${tRNA_group_x(d)}, ${tRNA_group_y(d)})`)

  tRNAGroup
    .append("rect")

    .attr("height", 30)
    .attr("width", d => Math.abs(d.Stop - d.Start) / 10)
    .attr("fill", "gray")
    .attr("fill-opacity", 0.5)
    .style({ "stroke": "black", "stroke-width": "1px" })

  tRNAGroup.append("text").text(d => d.AminoAcid)
    .attr("font-size", "9")
    .style({ "text-anchor": "middle", "fill": "black" })
    .attr("x", d => ((Math.abs(d.Stop - d.Start) / 2) / 10))
    .attr("y", -5);

  gene = newPhages.selectAll(".genes")
    .data(function (d, i) { return d.genes || []; })
    .enter()
    .append("g").classed('geneGroup', true);

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
  gene.append("rect")
    .classed("generect", true)
    .on("click", function (d, i) {
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

      var phamWidth = 500;
      var phamHeight = 100;
      var phamAALength = Math.abs(d.stop - d.start) / 3.0;

      svgDomain.selectAll("*").remove();

      svgDomain
        .append("g")
        .attr("class", "domainVis")
        .append("rect") // 'gene' rect
        .attr("height", phamHeight)
        .attr("width", phamWidth)
        .attr("fill", d.phamColor)
        .attr("stroke", "black")
        .attr("stroke-width", 5)
        ;

      Meteor.call("get_domains_by_gene", d.geneID, dataset, function (error, selectedDomains) {
        Session.set('selectedDomains', selectedDomains);

        function numOfDomains() { return selectedDomains.length; }
        var numberOfDomains = numOfDomains();

        svgDomain
          .append("g")
          .attr("class", "domainVis")
          .selectAll(".domainRects")
          .data(selectedDomains)
          .enter()
          .append("rect") // 'domain' rect
          .attr("height", (phamHeight - 20) / (numberOfDomains))
          .attr("width", function (d) { return (Math.abs(d.query_end - d.query_start) / phamAALength) * phamWidth; })
          .attr("fill", "#ffbd88")
          .attr("stroke", "black")
          .attr("transform", function (d, i) { return "translate(" + (((d.query_start - 1) / phamAALength) * phamWidth) + "," + (10 + (i * ((phamHeight - 20) / numberOfDomains))) + ")"; })
          .on("mouseover", function (d) {
            d3.select(this).style({ "stroke": "black", "stroke-width": "2" });
            d3.select("#" + d.domainname + ".collapsible-header").style({ "font-weight": "bold" })
          })
          .on("mouseout", function (d) {
            d3.select(this).style({ "stroke": "black", "stroke-width": "1" });
            d3.select("div#" + d.domainname + ".collapsible-header").style({ "font-weight": "normal" })
          })
          .on("click", function (d) {
            d3.select("li#" + d.domainname).classed("active", !d3.select("li#" + d.domainname).classed("active"));
            if (d3.select("div#" + d.domainname).attr("class") === "active collapsible-header") {
              d3.select("div#" + d.domainname).classed("active collapsible-header", false);
              d3.select("div#" + d.domainname).classed("collapsible-header", true);
              d3.select("div#" + d.domainname + ".collapsible-body").style({ "display": "none" })
            }
            else {
              d3.select("div#" + d.domainname).classed("collapsible-header", false);
              d3.select("div#" + d.domainname).classed("active collapsible-header", true);
              d3.select("div#" + d.domainname + ".collapsible-body").style({ "display": "block" })
            }
          });
      });

      // TM Domains
      svgTMDomain.selectAll("*").remove();

      svgTMDomain
        .append("g")
        .attr("class", "domainVis")
        .append("rect") // 'gene' rect
        .attr("height", phamHeight)
        .attr("width", phamWidth)
        .attr("fill", d.phamColor)
        .attr("stroke", "black")
        .attr("stroke-width", 5);
      Meteor.call("get_tm_domains_by_gene", d.geneID, dataset, function (error, selectedTMDomains) {
        Session.set('selectedTMDomains', selectedTMDomains);

        function numOfTMDomains() { return selectedTMDomains.length; }
        var numberOfTMDomains = numOfTMDomains();

        svgTMDomain
          .append("g")
          .attr("class", "domainVis")
          .selectAll(".TMdomainRects")
          .data(selectedTMDomains)
          .enter()
          .append("rect") // 'domain' rect
          .attr("height", (phamHeight - 20) / (numberOfTMDomains))
          .attr("width", function (d) { return (Math.abs(d.query_end - d.query_start) / phamAALength) * phamWidth; })
          .attr("fill", "dodgerblue")
          .attr("stroke", "black")
          .attr("transform", function (d, i) { return "translate(" + (((d.query_start - 1) / phamAALength) * phamWidth) + "," + (10 + (i * ((phamHeight - 20) / numberOfTMDomains))) + ")"; })
          .on("mouseover", function (d) {
            d3.select(this).style({ "stroke": "black", "stroke-width": "2" });
            d3.select("#tm-domain-" + d._id._str + ".collapsible-header").style({ "font-weight": "bold" })
          })
          .on("mouseout", function (d) {
            d3.select(this).style({ "stroke": "black", "stroke-width": "1" });
            d3.select("div#tm-domain-" + d._id._str + ".collapsible-header").style({ "font-weight": "normal" })
          })
          .on("click", function (d) {
            d3.select("li#tm-domain-" + d._id._str).classed("active", !d3.select("li#tm-domain-" + d._id._str).classed("active"));
            if (d3.select("div#tm-domain-" + d._id._str).attr("class") === "active collapsible-header") {
              d3.select("div#tm-domain-" + d._id._str).classed("active collapsible-header", false);
              d3.select("div#tm-domain-" + d._id._str).classed("collapsible-header", true);
              d3.select("div#tm-domain-" + d._id._str + ".collapsible-body").style({ "display": "none" })
            }
            else {
              d3.select("div#tm-domain-" + d._id._str).classed("collapsible-header", false);
              d3.select("div#tm-domain-" + d._id._str).classed("active collapsible-header", true);
              d3.select("div#tm-domain-" + d._id._str + ".collapsible-body").style({ "display": "block" })
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

      var g = selectedGenomes.findOne({ phagename: nodedata.phagename }, { fields: { sequence: 1 } }).sequence;
      Session.set('selectedGeneNotes', d.genefunction);
      if (d.direction === "forward") {
        Session.set('selectedGene', ">" + nodedata.phagename + " gene " + d.name + "\n" + g.slice(d.start - 1, d.stop));
      }
      else {
        complementSeq = g.slice(d.stop - 1, d.start).split('').reverse().map(complement).join('');
        Session.set('selectedGene', ">" + nodedata.phagename + " gene " + d.name + "\n" + complementSeq);
      }

      var onModalClose = function () {
        d3.selectAll("g.domainVis").remove();
      };

      $('ul.tabs').tabs();
      $('#geneData').modal('open');
      $('#geneData')[0].M_Modal.options.complete = onModalClose;

    })
    .attr("height", function (d) { return 30; })
    .style({ "stroke": "black", "stroke-width": "1px" })
    .attr("id", function (d) {
      return d.geneID
    })

    .style({ "stroke-width": "1px" })
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
        return (d.domainCount === 0) ? "white" : "orange"
      }
      else if (Session.get("colorByTMDomains") === true) {
        return (d.tmDomainCount === 0) ? "white" : "dodgerblue"
      }
    })
    .attr("width", 0)
    .transition()
    .duration(1600)
    .attr("width", function (d) { return Math.abs(d.stop - d.start) / 10; });

  gene.append("text") // gene name
    .classed("geneNameLabel", true)
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
    .style({ "text-anchor": "middle", "fill": "black" })
    .text(function (d) { return d.name })

    .attr("opacity", 1);

  gene.append("text") // gene function
    .classed("functionLabel", true)
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
    .style({ "text-anchor": "middle", "fill": "black" })
    .attr("font-size", "11px")
    .text(function (d) { return d.genefunction; })

    .attr("opacity", function (d) {
      if (Session.get("showFunctionLabels") === true) { return 1; }
      else { return 0; }
    });

  gene.append("text") // pham name
    .classed("phamLabel", true)
    .style({ "fill": "black" })
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
  var hspGroupData = svgMap.selectAll(".hspGroup").data();

  var genome_pairs = [];
  phagesdata.forEach(function (d, i) {
    var c = phagesdata[i - 1];
    if (c && d) {
      genome_pairs.push({ query: c.phagename, subject: d.phagename });
      if (alignedGenomes.find({ query: c.phagename, subject: d.phagename }).count() === 0) {
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
  Tracker.autorun(() => {
    const user = Meteor.user();
    if (user && user.preferredDataset) {
      Session.set("currentDataset", user.preferredDataset);
    } else {
      Session.set("currentDataset", "Actino_Draft");
    }
  });

  Meteor.call('getlargestphamsize', function (error, result) {
    if (typeof error !== 'undefined') {
    }
    else {
      maxPham = result;
    }
  });

  Tracker.autorun(() => {
    const dataset = Session.get("currentDataset");
    if (!dataset) return; // Wait until it's set

    Meteor.call('getclusters', dataset, function (error, result) {
      if (typeof error !== 'undefined') {
        console.error('Error getting clusters:', error);
      } else {
        Session.set('clusters', result);
      }
    });

    Meteor.call('getphams', dataset, function (error, result) {
      if (typeof error !== 'undefined') {
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

  myURL = "https://phamerator.org/blastalign";
  //myURL = "http://localhost:8080";

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
      blastAlignmentsOutstanding = blastAlignmentsOutstanding - 1;
      alignedGenomes.remove({ "query": query.phagename, "subject": subject.phagename });
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

  if (blastAlignmentsOutstanding === 0) {
    window.requestAnimationFrame(function () {
      $(".restoring-your-work-toast").fadeOut();

      setTimeout(update_hsps(hspData), 0);
      Session.set("progressbarVisibility", false);
    });
  }
  else {

    i = 0;
    animate();
    function animate() {
      i == 0 && requestAnimationFrame(animate);
      Session.set("progressbarVisibility", true);
      Session.set("progressbarState", ((phagesdata.length - blastAlignmentsOutstanding) / phagesdata.length) * 100 + "%");
      i++;
    }
  }
};

Template.phages.onDestroyed(function () {
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

updateSessionStore = function () {
  Meteor.user().selectedData[Session.get('currentDataset')]['genomeMaps'] = selectedGenomes.find({}, { fields: { phagename: 1 } }).fetch().map(function (p) { return p.phagename; });
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
    if (event.target.checked) { M.toast({ html: 'drawing genome map...', displayLength: 1000 }); }
    let sc = event.target.getAttribute("data-subcluster");
    if (sc !== "" && !isNaN(Number(sc))) {
      sc = Number(sc);
    }

    $("#preloader").show(function () {
      if (event.target.id !== "Singletons") {
        clusterGenomes = Genomes.find({ cluster: event.target.getAttribute("data-cluster"), subcluster: sc }).fetch();
      }
      else {
        clusterGenomes = Genomes.find({ cluster: "", subcluster: "" }).fetch();
      }
      clusterPhageNames = clusterGenomes.map(function (obj) { return obj.phagename });
      let handler = Meteor.subscribe("genomesWithSeq", Session.get("currentDataset"), clusterPhageNames, {
        onReady: function () {
          clusterGenomes = Genomes.find({ cluster: event.target.getAttribute("data-cluster"), subcluster: sc })
            .fetch()
            .map(g => {
              g.subcluster = g.subcluster.toString()
              return g;
            });


          if (event.target.checked) {
            clusterGenomes.forEach(function (element, index, array) {

              selectedGenomes.upsert({ phagename: element.phagename }, {
                phageID: element.phageID,
                phagename: element.phagename,
                genomelength: element.genomelength,
                sequence: element.sequence,
                cluster: element.cluster,
                subcluster: element.subcluster
              }, function () {
                var dataset = Session.get('currentDataset');

                let selectedPhageNames = selectedGenomes.find({}, { phagename: 1 }).fetch().map(d => d.phagename)
                let new_session_tRNAsHandler = Meteor.subscribe("selected_tRNAs", dataset, selectedPhageNames, {
                  onReady: () => update_phages()
                });

                if (session_tRNAsHandler) {
                  session_tRNAsHandler.stop()
                }

                session_tRNAsHandler = new_session_tRNAsHandler;
                Meteor.call('updateSelectedData', 'cluster checked', dataset, element.phagename, true);
              });
            });
          }
          else {

            clusterGenomes.forEach(function (element, index, array) {

              hspData = hspData.filter(function (e, i, a) {
                return !((e.queryName === element.phagename) || (e.subjectName === element.phagename));
              });
              window.requestAnimationFrame(function () {
                update_hsps(hspData);
              });
              selectedGenomes.remove({ phagename: element.phagename }, function () {
                alignedGenomes.remove({ query: element.phagename }, function () {
                  alignedGenomes.remove({ subject: element.phagename }, function () {
                    var dataset = Session.get('currentDataset');

                    let selectedPhageNames = selectedGenomes.find({}, { phagename: 1 }).fetch().map(d => d.phagename)
                    let new_session_tRNAsHandler = Meteor.subscribe("selected_tRNAs", dataset, selectedPhageNames, {
                    });

                    if (session_tRNAsHandler) {
                      session_tRNAsHandler.stop()
                    }

                    session_tRNAsHandler = new_session_tRNAsHandler;

                    Meteor.call('updateSelectedData', 'cluster unchecked', dataset, element.phagename, false);
                  });
                });
              });
            });
          }
        }
      });
      genomesWithSeqHandlers.push(handler);
    });
    // });
  },
  "change .phageCheckbox": function (event, template) {
    $("#preloader").show(function () {
      // get a list of all phagenames on the client
      phagename = event.target.id;

      let handler = Meteor.subscribe("genomesWithSeq", Session.get("currentDataset"), [phagename], {
        onReady: function () {
          if (event.target.checked) {
            p = Genomes.findOne({ phagename: phagename });
            selectedGenomes.upsert({ phagename: p.phagename }, {
              phagename: p.phagename,
              genomelength: p.genomelength,
              sequence: p.sequence,
              cluster: p.cluster,
              subcluster: p.subcluster
            }, function () {
              var dataset = Session.get('currentDataset');
              let selectedPhageNames = selectedGenomes.find({}, { phagename: 1 }).fetch().map(d => d.phagename)
              let new_session_tRNAsHandler = Meteor.subscribe("selected_tRNAs", dataset, selectedPhageNames, {
                onReady: () => {
                  update_phages()
                  update_hsps(hspData)
                }
              });

              if (session_tRNAsHandler) {
                session_tRNAsHandler.stop()
              }

              session_tRNAsHandler = new_session_tRNAsHandler;
              Meteor.call('updateSelectedData', 'phage checked', dataset, phagename, true);
            });
          }
          // if user just unselected a phage, it exists on the client but shouldn't
          else {

            hspData = hspData.filter(function (e, i, a) {
              return !((e.queryName === phagename) || (e.subjectName === phagename));
            });
            window.requestAnimationFrame(function () {
              update_hsps(hspData);
            });
            selectedGenomes.remove({ "phagename": phagename }, function () {
              alignedGenomes.remove({ query: phagename }, function () {
                alignedGenomes.remove({ subject: phagename }, function () {
                  var dataset = Session.get('currentDataset');
                  let selectedPhageNames = selectedGenomes.find({}, { phagename: true }).fetch().map(d => d.phagename)
                  let new_session_tRNAsHandler = Meteor.subscribe("selected_tRNAs", dataset, selectedPhageNames, {
                    onReady: () => {
                      update_phages()
                      update_hsps(hspData)
                    }
                  });

                  if (session_tRNAsHandler) {
                    session_tRNAsHandler.stop()
                  }

                  session_tRNAsHandler = new_session_tRNAsHandler;
                  Meteor.call('updateSelectedData', 'phage unchecked', dataset, phagename, false);
                });
              });
            });
          }
        }
      });
      genomesWithSeqHandlers.push(handler);

    });
  },

  "favorites-click": function (event, template) {
    var fav = d3.select("#" + event.target.id);
    if (!fav.classed("favorite")) {
      Meteor.call('updateSubclusterFavorites', event.target.id, true);
      fav.classed("favorite", true);
      fav.classed("yellow-text", true);
      fav.classed("grey-text", false);
    }
    else {
      Meteor.call('updateSubclusterFavorites', event.target.id, false);
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
    Meteor.call('updateSelectedData', 'clear selection', dataset, "", true);

    svgMap.selectAll(".hspGroup").remove();
  },
  "click #expand_all": function (event, template) {
    var instance = M.FloatingActionButton.getInstance($('.fixed-action-btn')[0]);
    if (instance) instance.close();

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

Template.registerHelper('clusterIsChecked', function (cluster, subcluster) {

  phagesInCluster = Genomes.find({ cluster: cluster, subcluster: subcluster }, { fields: { "phagename": 1 } }).fetch();
  r = true;
  phagesInCluster.forEach(function (phage, phageIndex, myPhageArray) {
    if (selectedGenomes.find({ "phagename": phage.phagename }).count() == 0) {
      r = false;
    }
  });
  return r;
});

Template.registerHelper('phageIsChecked', function (input) {
  return selectedGenomes.find({ "phagename": input }).count() > 0;
});

Template.cluster.helpers({
  selectedCount: function (cluster, subcluster) {
    count = selectedGenomes.find({ cluster: cluster, subcluster: subcluster }).count();
    if (count === 0) {
      return "";
    }
    return count;
  },
  selectedClass: function (cluster, subcluster) {
    count = selectedGenomes.find({ cluster: cluster, subcluster: subcluster }).count();
    if (count === 0) {
      return "badge";
    }
    return "purple new badge";
  },
  dataBadgeCaption: function (cluster, subcluster) {
    count = selectedGenomes.find({ cluster: cluster, subcluster: subcluster }).count();
    if (count === 0) {
      return "";
    }
    else if (count === 1) {
      return "selected genome";
    }
    return "selected genomes";
  },
  favoriteSubcluster: function (cluster, subcluster) {
    if (Meteor.user() && Meteor.user().selectedData && Meteor.user().selectedData[Session.get('currentDataset')] && Meteor.user().selectedData[Session.get('currentDataset')].subclusterFavorites) {
      var favs = Meteor.user().selectedData[Session.get('currentDataset')].subclusterFavorites;
      if (cluster === "") {
        if (favs.indexOf("favorite-Singletons") < 0) {
          return "grey-text";
        }
      }
      else if (favs.indexOf("favorite-" + cluster + subcluster) < 0) {
        return "grey-text";
      }
      return "yellow-text favorite";
    }
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
    return Session.get("colorbByTMDomains")
  },
  'phamColorState': function () {
    return Session.get("colorByPhams");
  }

});
