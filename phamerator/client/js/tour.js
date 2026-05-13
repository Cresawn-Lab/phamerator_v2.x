import introJs from 'intro.js';
import 'intro.js/introjs.css';
import '../css/tour.css';
import { FlowRouter } from 'meteor/ostrio:flow-router-extra';

// Route path map
const ROUTES = {
  home: '/',
  domains: '/domains',
  phages: '/phages'
};

// All tour segments, grouped by page
const TOUR_SEGMENTS = [
  {
    route: 'home',
    steps: [
      {
        title: 'Welcome to Phamerator',
        intro: 'This interactive tour will guide you through the main features of Phamerator. We\'ll walk you through each page!'
      },
      {
        element: '.dropdown-trigger',
        intro: 'Use this dropdown to select a phage database. Different databases contain different sets of genomes.',
        position: 'bottom'
      },
      {
        element: 'a[href="/domains"]',
        intro: 'The Domains tab lets you search for conserved protein domains. Let\'s go there next!',
        position: 'bottom'
      }
    ]
  },
  {
    route: 'domains',
    steps: [
      {
        title: 'Domain Search',
        intro: 'Welcome to the Domains page! Here you can search for conserved protein domains across phages.'
      },
      {
        element: '#domain_input',
        intro: 'Enter a domain name (like "HNH endonuclease") here to search for matching phage genes across the dataset.',
        position: 'bottom'
      }
    ]
  },
  {
    route: 'phages',
    steps: [
      {
        title: 'Genome Maps',
        intro: 'Welcome to Genome Maps! Here you can create comparative maps to visualize gene synteny and similarity.'
      },
      {
        element: '#cluster-list',
        intro: 'To create a map, start by expanding a cluster and checking the boxes next to at least two phages you want to compare.',
        position: 'right'
      },
      {
        element: '#viewMapTab',
        intro: 'Once you have selected two or more phages, click the "View Map" tab here to generate and explore your comparative genome map.',
        position: 'bottom'
      },
      {
        element: '#genome-map',
        title: 'Your Comparative Map',
        intro: 'Your comparative map appears here! We\'ve automatically selected some phages and switched to this tab for you.',
        position: 'top'
      },
      {
        element: '#menu2',
        title: 'Map Settings',
        intro: 'Use this floating button to access map settings (like coloring and labels) or to export your map as an SVG image.',
        position: 'left'
      }
    ]
  },
  {
    // Return home for final steps
    route: 'home',
    steps: [
      {
        element: '.start-tour-btn',
        intro: 'You can restart this tour anytime by clicking this button. Enjoy Phamerator!',
        position: 'bottom'
      }
    ]
  }
];

// Track progress across segments
let currentSegmentIndex = 0;

function navigateTo(routeName) {
  const path = ROUTES[routeName];
  if (path && window.location.pathname !== path) {
    FlowRouter.go(path);
    return true; // navigated
  }
  return false; // already there
}

function waitForElement(selector) {
  return new Promise((resolve) => {
    if (document.querySelector(selector)) {
      resolve(true);
      return;
    }
    resolve(false);
  });
}

function runSegment(segmentIndex) {
  if (segmentIndex >= TOUR_SEGMENTS.length) {
    // Tour complete
    return;
  }

  currentSegmentIndex = segmentIndex;
  const segment = TOUR_SEGMENTS[segmentIndex];
  const didNavigate = navigateTo(segment.route);

  function launchSegment() {
    // Filter steps to only include ones whose elements actually exist
    const validSteps = [];
    for (const step of segment.steps) {
      if (!step.element) {
        validSteps.push(step);
      } else if (document.querySelector(step.element)) {
        validSteps.push(step);
      }
    }

    if (validSteps.length === 0) {
      // Skip this segment if no valid steps (e.g., not logged in)
      runSegment(segmentIndex + 1);
      return;
    }

    const isLastSegment = segmentIndex === TOUR_SEGMENTS.length - 1;
    const intro = introJs();

    intro.setOptions({
      steps: validSteps,
      showProgress: true,
      showBullets: true,
      exitOnOverlayClick: false,
      exitOnEsc: true,
      doneLabel: isLastSegment ? 'Finish' : 'Continue →',
      showStepNumbers: false
    });

    // Manually inject a bulletproof custom close button
    intro.onchange(function() {
      setTimeout(() => {
        const tooltip = document.querySelector('.introjs-tooltip');
        if (tooltip && !document.querySelector('.custom-introjs-close')) {
          const closeBtn = document.createElement('div');
          closeBtn.className = 'custom-introjs-close';
          closeBtn.innerHTML = '×';
          closeBtn.style.cssText = 'position: absolute; top: -12px; right: -12px; width: 28px; height: 28px; background: #f44336; color: white; border-radius: 50%; text-align: center; line-height: 26px; cursor: pointer; font-size: 22px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.2); z-index: 9999999; font-family: sans-serif;';
          closeBtn.onclick = function() { intro.exit(); };
          tooltip.appendChild(closeBtn);
        }
      }, 50);
    });

    intro.onbeforechange(function(targetElement) {
      if (targetElement && targetElement.id === 'genome-map') {
        // Automatically select exactly 2 phages if none are selected
        // We first uncheck any cluster checkboxes to clear the board, just in case
        const checkedClusters = document.querySelectorAll('.clusterCheckbox:checked');
        if (checkedClusters.length > 0) {
          checkedClusters.forEach(cb => cb.click());
        }

        // Open the first cluster to ensure individual phage checkboxes are rendered
        const firstHeader = document.querySelector('#cluster-list .collapsible-header');
        if (firstHeader && !firstHeader.classList.contains('active')) {
          firstHeader.click();
        }
        
        // Wait briefly for Blaze to render the individual checkboxes
        setTimeout(() => {
          const phageBoxes = document.querySelectorAll('.phageCheckbox');
          let clickedCount = 0;
          for (let i = 0; i < phageBoxes.length; i++) {
            if (!phageBoxes[i].checked) {
              phageBoxes[i].click();
              clickedCount++;
            }
            if (clickedCount >= 2) break;
          }
        }, 300);

        // Switch to the View Map tab
        const viewMapTab = document.getElementById('viewMapTab');
        if (viewMapTab) viewMapTab.click();
      }
    });

    intro.oncomplete(function () {
      if (!isLastSegment) {
        // Move to the next segment (next page)
        runSegment(segmentIndex + 1);
      }
    });

    intro.start();
  }

  if (didNavigate) {
    // Wait for Blaze to finish rendering the new page
    Tracker.afterFlush(() => {
      requestAnimationFrame(launchSegment);
    });
  } else {
    launchSegment();
  }
}

export function startTour() {
  // Always start from the beginning
  currentSegmentIndex = 0;
  runSegment(0);
}

export function autoStartTour() {
  const tourSeen = localStorage.getItem('phameratorTourSeen');
  if (!tourSeen) {
    localStorage.setItem('phameratorTourSeen', 'true');
    startTour();
  }
}
