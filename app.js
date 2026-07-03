(function () {
  const categories = window.BGM_CATEGORIES;
  let player = null;
  let currentCategory = "lofi";
  let currentTrack = null;
  let lastTrackId = null;
  let autoNext = true;
  let apiReady = false;

  const els = {
    title: document.getElementById("track-title"),
    meta: document.getElementById("track-meta"),
    categoryButtons: document.getElementById("category-buttons"),
    playPause: document.getElementById("btn-play-pause"),
    next: document.getElementById("btn-next"),
    autoNext: document.getElementById("opt-auto-next"),
    compact: document.getElementById("opt-compact"),
    volume: document.getElementById("volume"),
    playerWrap: document.getElementById("player-wrap"),
    placeholder: document.getElementById("player-placeholder"),
  };

  function allTracks() {
    return Object.entries(categories).flatMap(([key, cat]) =>
      cat.tracks.map((t) => ({ ...t, categoryKey: key, categoryLabel: cat.label }))
    );
  }

  function tracksForCategory(key) {
    if (key === "all") return allTracks();
    return (categories[key]?.tracks || []).map((t) => ({
      ...t,
      categoryKey: key,
      categoryLabel: categories[key].label,
    }));
  }

  function pickRandomTrack(categoryKey) {
    const pool = tracksForCategory(categoryKey);
    if (!pool.length) return null;

    if (pool.length === 1) return pool[0];

    let track;
    let attempts = 0;
    do {
      track = pool[Math.floor(Math.random() * pool.length)];
      attempts++;
    } while (track.id === lastTrackId && attempts < 8);

    return track;
  }

  function setNowPlaying(track, categoryKey) {
    currentTrack = track;
    lastTrackId = track?.id ?? null;

    if (!track) {
      els.title.textContent = "카테고리를 선택하고 재생하세요";
      els.meta.textContent = "";
      return;
    }

    const catLabel =
      categoryKey === "all"
        ? track.categoryLabel
        : categories[categoryKey]?.label || track.categoryLabel;

    els.title.textContent = track.title;
    els.meta.textContent = `${catLabel} · YouTube`;
  }

  function renderCategories() {
    const allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.className = "cat-btn all-random";
    allBtn.dataset.category = "all";
    allBtn.textContent = "🎲 전체 랜덤";
    allBtn.addEventListener("click", () => selectCategory("all"));
    els.categoryButtons.appendChild(allBtn);

    Object.entries(categories).forEach(([key, cat]) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cat-btn";
      btn.dataset.category = key;
      btn.textContent = `${cat.emoji} ${cat.label}`;
      btn.addEventListener("click", () => selectCategory(key));
      els.categoryButtons.appendChild(btn);
    });

    updateCategoryUI();
  }

  function updateCategoryUI() {
    els.categoryButtons.querySelectorAll(".cat-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.category === currentCategory);
    });
  }

  function selectCategory(key) {
    currentCategory = key;
    updateCategoryUI();
    playRandom();
  }

  function loadYouTubeAPI() {
    if (window.YT?.Player) {
      onYouTubeIframeAPIReady();
      return;
    }

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  }

  window.onYouTubeIframeAPIReady = function () {
    apiReady = true;
    player = new YT.Player("player", {
      height: "100%",
      width: "100%",
      playerVars: {
        autoplay: 0,
        rel: 0,
        modestbranding: 1,
        playsinline: 1,
      },
      events: {
        onReady: () => {
          player.setVolume(Number(els.volume.value));
        },
        onStateChange: (event) => {
          if (event.data === YT.PlayerState.ENDED && autoNext) {
            playRandom();
          }
          updatePlayPauseIcon();
        },
      },
    });
  };

  function playTrack(track) {
    if (!track) return;

    setNowPlaying(track, currentCategory);
    els.playerWrap.classList.add("has-video");

    if (!apiReady || !player?.loadVideoById) {
      setTimeout(() => playTrack(track), 200);
      return;
    }

    player.loadVideoById({
      videoId: track.id,
      startSeconds: 0,
    });
    updatePlayPauseIcon();
  }

  function playRandom() {
    const track = pickRandomTrack(currentCategory);
    if (track) playTrack(track);
  }

  function togglePlayPause() {
    if (!player?.getPlayerState) return;

    const state = player.getPlayerState();
    if (state === YT.PlayerState.PLAYING) {
      player.pauseVideo();
    } else {
      if (!currentTrack) {
        playRandom();
      } else {
        player.playVideo();
      }
    }
    updatePlayPauseIcon();
  }

  function updatePlayPauseIcon() {
    if (!player?.getPlayerState) {
      els.playPause.textContent = "▶";
      return;
    }
    const playing = player.getPlayerState() === YT.PlayerState.PLAYING;
    els.playPause.textContent = playing ? "⏸" : "▶";
  }

  els.playPause.addEventListener("click", togglePlayPause);
  els.next.addEventListener("click", playRandom);

  els.autoNext.addEventListener("change", (e) => {
    autoNext = e.target.checked;
  });

  els.compact.addEventListener("change", (e) => {
    els.playerWrap.classList.toggle("compact", e.target.checked);
  });

  els.volume.addEventListener("input", (e) => {
    if (player?.setVolume) player.setVolume(Number(e.target.value));
  });

  renderCategories();
  loadYouTubeAPI();
})();