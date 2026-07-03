(function () {
  const categories = window.BGM_CATEGORIES;
  let player = null;
  let currentCategory = "lofi";
  let currentTrack = null;
  let lastTrackId = null;
  let autoNext = true;
  let apiReady = false;
  let wakeLock = null;
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  const els = {
    title: document.getElementById("track-title"),
    meta: document.getElementById("track-meta"),
    categoryButtons: document.getElementById("category-buttons"),
    playPause: document.getElementById("btn-play-pause"),
    next: document.getElementById("btn-next"),
    autoNext: document.getElementById("opt-auto-next"),
    compact: document.getElementById("opt-compact"),
    wakeLockWrap: document.getElementById("opt-wake-lock-wrap"),
    wakeLock: document.getElementById("opt-wake-lock"),
    mobileActions: document.getElementById("mobile-actions"),
    mobileTip: document.getElementById("mobile-tip"),
    openYoutube: document.getElementById("btn-open-youtube"),
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

  function categoryLabelFor(track, categoryKey) {
    return categoryKey === "all"
      ? track.categoryLabel
      : categories[categoryKey]?.label || track.categoryLabel;
  }

  function setNowPlaying(track, categoryKey) {
    currentTrack = track;
    lastTrackId = track?.id ?? null;

    if (!track) {
      els.title.textContent = "카테고리를 선택하고 재생하세요";
      els.meta.textContent = "";
      els.openYoutube.disabled = true;
      clearMediaSession();
      return;
    }

    const catLabel = categoryLabelFor(track, categoryKey);
    els.title.textContent = track.title;
    els.meta.textContent = `${catLabel} · YouTube`;
    els.openYoutube.disabled = false;
    updateMediaSession(track, catLabel);
  }

  function updateMediaSession(track, catLabel) {
    if (!("mediaSession" in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: catLabel,
      album: "BGM Player",
    });

    navigator.mediaSession.setActionHandler("play", () => player?.playVideo());
    navigator.mediaSession.setActionHandler("pause", () => player?.pauseVideo());
    navigator.mediaSession.setActionHandler("nexttrack", () => playRandom());
    navigator.mediaSession.setActionHandler("previoustrack", () => playRandom());
  }

  function clearMediaSession() {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = null;
  }

  async function acquireWakeLock() {
    if (!els.wakeLock.checked || !("wakeLock" in navigator)) return;

    try {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => {
        wakeLock = null;
      });
    } catch {
      els.wakeLock.checked = false;
    }
  }

  async function releaseWakeLock() {
    if (!wakeLock) return;
    try {
      await wakeLock.release();
    } catch {
      // ignore
    }
    wakeLock = null;
  }

  async function syncWakeLockWithPlayback() {
    const playing = player?.getPlayerState?.() === YT.PlayerState.PLAYING;
    if (playing && els.wakeLock.checked) {
      await acquireWakeLock();
    } else {
      await releaseWakeLock();
    }
  }

  function youtubeWatchUrl(videoId) {
    return `https://www.youtube.com/watch?v=${videoId}`;
  }

  function openInYoutubeApp(videoId) {
    const webUrl = youtubeWatchUrl(videoId);
    const isAndroid = /Android/i.test(navigator.userAgent);

    if (isAndroid) {
      const intentUrl =
        `intent://www.youtube.com/watch?v=${videoId}` +
        "#Intent;package=com.google.android.youtube;scheme=https;end";
      window.location.href = intentUrl;
      setTimeout(() => {
        window.open(webUrl, "_blank", "noopener,noreferrer");
      }, 700);
      return;
    }

    window.open(webUrl, "_blank", "noopener,noreferrer");
  }

  function setupMobileUI() {
    if (!isMobile) return;

    els.mobileTip.hidden = false;
    els.mobileActions.hidden = false;

    if ("wakeLock" in navigator) {
      els.wakeLockWrap.hidden = false;
    }
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
          syncWakeLockWithPlayback();
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
    syncWakeLockWithPlayback();
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

  els.wakeLock.addEventListener("change", () => {
    syncWakeLockWithPlayback();
  });

  els.openYoutube.addEventListener("click", () => {
    if (!currentTrack?.id) return;
    openInYoutubeApp(currentTrack.id);
  });

  els.volume.addEventListener("input", (e) => {
    if (player?.setVolume) player.setVolume(Number(e.target.value));
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      syncWakeLockWithPlayback();
    }
  });

  setupMobileUI();
  renderCategories();
  loadYouTubeAPI();
})();