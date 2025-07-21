(function($) {

	var	$window = $(window),
		$body = $('body'),
		$sidebar = $('#sidebar');

	// Breakpoints.
	breakpoints({
		xlarge:   [ '1281px',  '1680px' ],
		large:    [ '981px',   '1280px' ],
		medium:   [ '737px',   '980px'  ],
		small:    [ '481px',   '736px'  ],
		xsmall:   [ null,      '480px'  ]
	});

	// Hack: Enable IE flexbox workarounds.
	if (browser.name == 'ie')
		$body.addClass('is-ie');

	// Play initial animations on page load.
	$window.on('load', function() {
		window.setTimeout(function() {
			$body.removeClass('is-preload');
		}, 100);
	});

	// Forms.

	// Hack: Activate non-input submits.
	$('form').on('click', '.submit', function(event) {

		// Stop propagation, default.
		event.stopPropagation();
		event.preventDefault();

		// Submit form.
		$(this).parents('form').submit();

	});

	// Sidebar.
	if ($sidebar.length > 0) {

		var $sidebar_a = $sidebar.find('a');

		$sidebar_a
			.addClass('scrolly')
			.on('click', function() {

				var $this = $(this);
				
				// Deactivate all links.
				$sidebar_a.removeClass('active');

				// Activate link *and* lock it (so Scrollex doesn't try to activate other links as we're scrolling to this one's section).
				$this
					.addClass('active')
					.addClass('active-locked');

			})
			.each(function() {

				var	$this = $(this),
					id = $this.attr('href'),
					// IMPORTANT FIX: Only process links that are valid internal anchor links for Scrollex
					// 1. Must start with '#'
					// 2. Must not be just '#' (empty anchor, not a target for scrollex)
					// 3. Must not be just '/' (root path, which is not a valid scrollex target)
					// 4. Must not be a relative path to another page (e.g., 'index.html', 'blog', 'about.html')
					if (!id || id.charAt(0) !== '#' || id === '#' || id === '/') { // <--- THIS IS THE CORRECTED LINE
						return; // Skip this link if it's not a valid internal anchor for scrollex
					}
					
					$section = $(id);

				// No section for this link? Bail.
				if ($section.length < 1)
					return;

				// Scrollex.
				$section.scrollex({
					mode: 'middle',
					top: '-20vh',
					bottom: '-20vh',
					initialize: function() {

						// Deactivate section.
						$section.addClass('inactive');

					},
					enter: function() {

						// Activate section.
						$section.removeClass('inactive');

						// No locked links? Deactivate all links and activate this section's one.
						if ($sidebar_a.filter('.active-locked').length == 0) {

							$sidebar_a.removeClass('active');
							$this.addClass('active');

						}

						// Otherwise, if this section's link is the one that's locked, unlock it.
						else if ($this.hasClass('active-locked'))
							$this.removeClass('active-locked');

					}
				});

			});

	}

	// Toggle.
	$(document).ready(function() {
		const $sidebar = $('#sidebar');
		const $toggleBtn = $('#toggleBtn');
		const $content = $('#content');

		$toggleBtn.on('click', function() {
			$sidebar.toggleClass('hidden');
			$content.toggleClass('expanded');
		});

		function checkScreenSize() {
			if ($(window).width() < 1280) {
				$sidebar.addClass('hidden');
			} else {
				$sidebar.removeClass('hidden');
			}
		}

		$(window).on('resize', checkScreenSize);
		checkScreenSize(); // Initial check
	});


	// Scrolly.
	$('.scrolly').scrolly({
		speed: 1000,
		offset: function() {

			// If <=large, >small, and sidebar is present, use its height as the offset.
			if (breakpoints.active('<=large')
				&&	!breakpoints.active('<=small')
				&&	$sidebar.length > 0)
				return $sidebar.height();

			return 0;

		}
	});

	// Spotlights.
	$('.spotlights > section')
		.scrollex({
			mode: 'middle',
			top: '-10vh',
			bottom: '-10vh',
			initialize: function() {

				// Deactivate section.
				$(this).addClass('inactive');

			},
			enter: function() {

				// Activate section.
				$(this).removeClass('inactive');

			}
		})
		.each(function() {

			var	$this = $(this),
				$image = $this.find('.image'),
				$img = $image.find('img'),
				x;

			// Assign image.
			$image.css('background-image', 'url(' + $img.attr('src') + ')');

			// Set background position.
			if (x = $img.data('position'))
				$image.css('background-position', x);

			// Hide <img>.
			$img.hide();

		});

	// Features.
	$('.features')
		.scrollex({
			mode: 'middle',
			top: '-20vh',
			bottom: '-20vh',
			initialize: function() {

				// Deactivate section.
				$(this).addClass('inactive');

			},
			enter: function() {

				// Activate section.
				$(this).removeClass('inactive');

			}
		});

	// Create the button element
	const backToTopButton = document.createElement('button');
	backToTopButton.id = 'back-to-top';
	backToTopButton.textContent = 'Top';
	document.body.appendChild(backToTopButton);

	// Show or hide the button based on scroll position
	window.onscroll = function() {
		if (document.body.scrollTop > 20 || document.documentElement.scrollTop > 20) {
			backToTopButton.style.display = 'block';
		} else {
			backToTopButton.style.display = 'none';
		}
	};

	// Scroll to the top when the button is clicked
	backToTopButton.onclick = function() {
		document.body.scrollTop = 0;
		document.documentElement.scrollTop = 0;
	};

	//  Tag click and display
	document.addEventListener('DOMContentLoaded', function () {
		const tags = document.querySelectorAll('.tag');
		const blogPosts = document.querySelectorAll('.blog-post');

		// Show all blog posts initially
		showPostsByTag('all');

		// Add click event listeners to all tags
		tags.forEach(tag => {
			tag.addEventListener('click', function () {
				const tagValue = this.getAttribute('data-tag');
				showPostsByTag(tagValue);
			});
		});

		function showPostsByTag(tag) {
			blogPosts.forEach(post => {
				const postTags = post.getAttribute('data-tags');
				if (tag === 'all' || postTags.includes(tag)) {
					post.style.display = 'block'; // Show post
				} else {
					post.style.display = 'none';  // Hide post
				}
			});
		}
	});

	// making news banner change
	const bannerContent = document.getElementById("bannerContent");
	const messages = [
		{
			text: 'Announcing our first dataset <strong>TxT360</strong>: Learn More Here.',
			link: 'https://huggingface.co/spaces/LLM360/TxT360'
		},
		{
			text: 'Announcing <strong>Analysis360</strong>: Open Implementations of LLM Analyses',
			link: 'https://github.com/LLM360/Analysis360' // Change this to your hiring link
		},
		{
			text: 'The Institute of Foundation Model is <strong>hiring</strong> !',
			link: 'https://mbzuai.ac.ae/institute-of-foundation-models/' // Change this to your hiring link
		}

	];

	let currentIndex = 0;

	function updateBanner() {
		bannerContent.innerHTML = messages[currentIndex].text;
		bannerContent.href = messages[currentIndex].link;
	}

// Previous button action
	document.getElementById("prevBtn").addEventListener("click", () => {
		currentIndex = (currentIndex === 0) ? messages.length - 1 : currentIndex - 1;
		updateBanner();
	});

// Next button action
	document.getElementById("nextBtn").addEventListener("click", () => {
		currentIndex = (currentIndex === messages.length - 1) ? 0 : currentIndex + 1;
		updateBanner();
	});

	// Scroll to see all pictures in the gallery
	document.addEventListener('DOMContentLoaded', function () {
		function setupGalleryNavigation(galleryId, prevButtonId, nextButtonId) {
			const gallery = document.getElementById(galleryId);
			const prevButton = document.getElementById(prevButtonId);
			const nextButton = document.getElementById(nextButtonId);
			let scrollAmount = 0;
			let scrollPerClick = gallery.clientWidth;
			let maxScroll = gallery.scrollWidth - gallery.clientWidth;

			function updateScrollMetrics() {
				scrollPerClick = gallery.clientWidth;
				maxScroll = gallery.scrollWidth - gallery.clientWidth;
				// Show or hide buttons based on whether scrolling is necessary
				if (maxScroll <= 0) {
					prevButton.style.display = 'none';
					nextButton.style.display = 'none';
				} else {
					prevButton.style.display = 'block';
					nextButton.style.display = 'block';
				}
			}

			nextButton.addEventListener('click', () => {
				if (scrollAmount < maxScroll) {
					scrollAmount += scrollPerClick;
					if (scrollAmount > maxScroll) {
						scrollAmount = maxScroll;
					}
					gallery.style.transform = `translateX(-${scrollAmount}px)`;
				}
				// Check button visibility after scrolling
				updateButtonVisibility();
			});

			prevButton.addEventListener('click', () => {
				if (scrollAmount > 0) {
					scrollAmount -= scrollPerClick;
					if (scrollAmount < 0) {
						scrollAmount = 0;
					}
					gallery.style.transform = `translateX(-${scrollAmount}px)`;
				}
				// Check button visibility after scrolling
				updateButtonVisibility();
			});

			function updateButtonVisibility() {
				// Show or hide buttons based on current scroll position
				if (scrollAmount <= 0) {
					prevButton.style.display = 'none';
				} else {
					prevButton.style.display = 'block';
				}
				if (scrollAmount >= maxScroll) {
					nextButton.style.display = 'none';
				} else {
					nextButton.style.display = 'block';
				}
			}

			window.addEventListener('resize', () => {
				updateScrollMetrics();
				// Ensure gallery is still correctly aligned after resize
				if (scrollAmount > maxScroll) {
					scrollAmount = maxScroll;
					gallery.style.transform = `translateX(-${scrollAmount}px)`;
				}
				// Check button visibility after resize
				updateButtonVisibility();
			});

			// Initial calculation
			updateScrollMetrics();
			// Initial button visibility check
			updateButtonVisibility();
		}

		setupGalleryNavigation('gallery1', 'prevButton1', 'nextButton1');
		setupGalleryNavigation('gallery2', 'prevButton2', 'nextButton2');
		setupGalleryNavigation('gallery3', 'prevButton3', 'nextButton3');
		setupGalleryNavigation('gallery4', 'prevButton4', 'nextButton4');
	});


})(jQuery);