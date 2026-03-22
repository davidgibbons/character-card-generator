// Main Application Controller
class CharacterGeneratorApp {
  constructor() {
    this.characterGenerator = window.characterGenerator;
    this.imageGenerator = window.imageGenerator;
    this.pngEncoder = window.pngEncoder;
    this.config = window.config;
    this.apiHandler = window.apiHandler;
    this.storage = window.characterStorage;
    this.storageReady = false;

    this.currentCharacter = null;
    this.currentCardSlug = null;
    this.originalCharacter = null; // Store the original AI-generated version
    this.currentImageUrl = null;
    this.lorebookData = null; // Store loaded lorebook data
    this.referenceImageDataUrl = "";
    // Removed currentImageBlob - we now convert fresh from URL on download
    this.lockedFields = new Set();
    this.lastEvaluation = null;
    this.isGenerating = false;
    this.activeTab = 'create';
    this.activeSubtab = 'char-image';

    this.init();
  }

  async init() {
    const savedConfig = localStorage.getItem("charGeneratorConfig");
    if (
      savedConfig &&
      (savedConfig.includes('"api":{"baseUrl"') ||
        savedConfig.includes('"textModel"'))
    ) {
      localStorage.removeItem("charGeneratorConfig");
    }

    await this.config.waitForConfig();
    await this.ensureStorageReady();
    this.config.saveToForm();
    this.applyTheme(localStorage.getItem("theme") || "light");
    this.initTabs();
    this.initSubtabs();
    this.initSplitPane();
    this.initLibraryDrawer();
    this.bindEvents();
    // Attach @mention autocomplete to concept and revision textareas
    if (typeof MentionAutocomplete !== "undefined") {
      this.mentionConcept = new MentionAutocomplete("character-concept", this.storage);
      this.mentionConcept.attach();
      this.mentionRevision = new MentionAutocomplete("revision-instruction", this.storage);
      this.mentionRevision.attach();
    }
    this.checkAPIStatus();
    this.refreshLibraryViews();
    this.checkMigrationBanner();
  }

  applyTheme(theme) {
    document.documentElement.dataset.theme = theme === "dark" ? "dark" : "";
    const moon = document.getElementById("theme-icon-moon");
    const sun = document.getElementById("theme-icon-sun");
    if (moon) moon.style.display = theme === "dark" ? "none" : "";
    if (sun) sun.style.display = theme === "dark" ? "" : "none";
  }

  async ensureStorageReady() {
    if (!this.storage) {
      this.storageReady = false;
      this.updateLibraryStatus("Local library unavailable in this session.");
      return;
    }

    try {
      await this.storage.init();
      this.storageReady = true;
      this.updateLibraryStatus("Local library ready.");
    } catch (error) {
      console.error("Failed to initialize IndexedDB:", error);
      this.storageReady = false;
      this.updateLibraryStatus(
        "IndexedDB failed to initialize. Prompt/card saving is disabled.",
      );
    }
  }

  // ── Tab management ──────────────────────────────────────────────────────
  initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });
    // Keyboard nav (left/right arrows)
    const tabBar = document.querySelector('.tab-bar');
    if (tabBar) {
      tabBar.addEventListener('keydown', (e) => {
        const tabs = [...tabBar.querySelectorAll('.tab-btn')];
        const idx = tabs.indexOf(document.activeElement);
        if (idx < 0) return;
        if (e.key === 'ArrowRight' && idx < tabs.length - 1) {
          tabs[idx + 1].focus();
          tabs[idx + 1].click();
        } else if (e.key === 'ArrowLeft' && idx > 0) {
          tabs[idx - 1].focus();
          tabs[idx - 1].click();
        }
      });
    }
  }

  slugifyName(name) {
    return (
      (name || "unnamed")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "unnamed"
    );
  }

  enableEditorTab() {
    const btn = document.querySelector('.tab-btn[data-tab="editor"]');
    if (btn) btn.disabled = false;
  }

  switchTab(name) {
    const targetBtn = document.querySelector(`.tab-btn[data-tab="${name}"]`);
    if (targetBtn?.disabled) return;
    this.activeTab = name;
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      const isActive = btn.dataset.tab === name;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    document.querySelectorAll('.tab-panel').forEach((panel) => {
      panel.classList.toggle('active', panel.id === `tab-${name}`);
    });
    this.clearTabBadge(name);
  }

  notifyTab(name) {
    if (this.activeTab === name) return;
    const badge = document.getElementById(`${name}-badge`);
    if (badge) badge.classList.add('visible');
  }

  clearTabBadge(name) {
    const badge = document.getElementById(`${name}-badge`);
    if (badge) badge.classList.remove('visible');
  }

  // ── Subtab management ──────────────────────────────────────────────────
  initSubtabs() {
    const subtabBtns = document.querySelectorAll('.subtab-btn');
    subtabBtns.forEach((btn) => {
      btn.addEventListener('click', () => this.switchSubtab(btn.dataset.subtab));
    });
  }

  switchSubtab(name) {
    this.activeSubtab = name;
    document.querySelectorAll('.subtab-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.subtab === name);
    });
    document.querySelectorAll('.subtab-panel').forEach((panel) => {
      panel.classList.toggle('active', panel.id === `subtab-${name}`);
    });
  }

  // ── Split pane ─────────────────────────────────────────────────────────
  initSplitPane() {
    const divider = document.getElementById('split-divider');
    if (!divider) return;

    const pane = divider.closest('.split-pane');
    const left = pane?.querySelector('.split-left');
    const right = pane?.querySelector('.split-right');
    if (!pane || !left || !right) return;

    // Restore saved ratio
    const savedRatio = localStorage.getItem('splitPaneRatio');
    if (savedRatio) {
      const ratio = parseFloat(savedRatio);
      if (ratio > 0.2 && ratio < 0.8) {
        left.style.flex = `0 0 ${ratio * 100}%`;
        right.style.flex = `1 1 auto`;
      }
    }

    let isDragging = false;

    const onPointerDown = (e) => {
      // Only horizontal drag on desktop
      if (window.innerWidth <= 700) return;
      isDragging = true;
      divider.classList.add('dragging');
      divider.setPointerCapture(e.pointerId);
      e.preventDefault();
    };

    const onPointerMove = (e) => {
      if (!isDragging) return;
      const paneRect = pane.getBoundingClientRect();
      const ratio = Math.min(0.8, Math.max(0.2, (e.clientX - paneRect.left) / paneRect.width));
      left.style.flex = `0 0 ${ratio * 100}%`;
      right.style.flex = `1 1 auto`;
      localStorage.setItem('splitPaneRatio', String(ratio));
    };

    const onPointerUp = () => {
      isDragging = false;
      divider.classList.remove('dragging');
    };

    divider.addEventListener('pointerdown', onPointerDown);
    divider.addEventListener('pointermove', onPointerMove);
    divider.addEventListener('pointerup', onPointerUp);
    divider.addEventListener('pointercancel', onPointerUp);
  }

  // ── Library drawer ─────────────────────────────────────────────────────
  initLibraryDrawer() {
    const openBtn = document.getElementById('library-drawer-btn');
    const closeBtn = document.getElementById('library-drawer-close');
    const backdrop = document.getElementById('library-drawer-backdrop');

    if (openBtn) openBtn.addEventListener('click', () => this.openLibraryDrawer());
    if (closeBtn) closeBtn.addEventListener('click', () => this.closeLibraryDrawer());
    if (backdrop) backdrop.addEventListener('click', () => this.closeLibraryDrawer());

    const librarySearch = document.getElementById('library-search');
    if (librarySearch) {
      librarySearch.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        document.querySelectorAll('#stored-cards-list .library-item').forEach((item) => {
          const name = item.dataset.cardName || "";
          item.style.display = name.includes(query) ? "" : "none";
        });
      });
    }

    // Escape key handled in existing keydown handler
  }

  openLibraryDrawer() {
    const drawer = document.getElementById('library-drawer');
    const backdrop = document.getElementById('library-drawer-backdrop');
    if (drawer) drawer.classList.add('open');
    if (backdrop) backdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
    this.refreshLibraryViews();
  }

  closeLibraryDrawer() {
    const drawer = document.getElementById('library-drawer');
    const backdrop = document.getElementById('library-drawer-backdrop');
    if (drawer) drawer.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
    document.body.style.overflow = '';
  }

  bindEvents() {
    // Theme toggle
    document.getElementById("theme-toggle-btn").addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      localStorage.setItem("theme", next);
      this.applyTheme(next);
    });

    // Generate button
    const generateBtn = document.getElementById("generate-btn");
    generateBtn.addEventListener("click", () => this.handleGenerate());

    // Stop button
    const stopBtn = document.getElementById("stop-btn");
    stopBtn.addEventListener("click", () => this.handleStop());

    // Download button
    const downloadBtn = document.getElementById("download-btn");
    downloadBtn.addEventListener("click", () => this.handleDownload());

    // Download JSON button
    const downloadJsonBtn = document.getElementById("download-json-btn");
    downloadJsonBtn.addEventListener("click", () => this.handleDownloadJSON());

    // Regenerate button
    const regenerateBtn = document.getElementById("regenerate-btn");
    regenerateBtn.addEventListener("click", () => this.handleRegenerate());

    // Import card button
    const importCardBtn = document.getElementById("import-card-btn");
    const importCardTopBtn = document.getElementById("import-card-top-btn");
    const importCardInput = document.getElementById("import-card-input");
    const importCardTopInput = document.getElementById("import-card-top-input");
    if (importCardInput || importCardTopInput) {
      if (importCardBtn) {
        importCardBtn.addEventListener("click", () =>
          (importCardInput || importCardTopInput).click(),
        );
      }
      if (importCardTopBtn) {
        importCardTopBtn.addEventListener("click", () =>
          (importCardTopInput || importCardInput).click(),
        );
      }
      if (importCardInput) {
        importCardInput.addEventListener("change", (e) =>
          this.handleImportCard(e),
        );
      }
      if (importCardTopInput) {
        importCardTopInput.addEventListener("change", (e) =>
          this.handleImportCard(e),
        );
      }
    }

    // SillyTavern push button
    const pushStBtn = document.getElementById("push-st-btn");
    if (pushStBtn) {
      pushStBtn.addEventListener("click", () => this.handlePushToST());
    }

    // SillyTavern pull buttons (result section + top of page)
    const pullStBtn = document.getElementById("pull-st-btn");
    if (pullStBtn) {
      pullStBtn.addEventListener("click", () => this.handlePullFromST());
    }
    const pullStTopBtn = document.getElementById("pull-st-top-btn");
    if (pullStTopBtn) {
      pullStTopBtn.addEventListener("click", () => this.handlePullFromST());
    }

    // SillyTavern browser modal
    const stModalOverlay = document.getElementById("st-browser-modal");
    const stModalCloseBtn = document.getElementById("st-modal-close-btn");
    if (stModalOverlay && stModalCloseBtn) {
      stModalCloseBtn.addEventListener("click", () => {
        stModalOverlay.classList.remove("show");
        document.body.style.overflow = "";
      });
      stModalOverlay.addEventListener("click", (e) => {
        if (e.target === stModalOverlay) {
          stModalOverlay.classList.remove("show");
          document.body.style.overflow = "";
        }
      });
    }

    // Revision button
    const reviseCharacterBtn = document.getElementById("revise-character-btn");
    if (reviseCharacterBtn) {
      reviseCharacterBtn.addEventListener("click", () =>
        this.handleReviseCharacter(),
      );
    }

    // Save card button
    const saveCardBtn = document.getElementById("save-card-btn");
    if (saveCardBtn) {
      saveCardBtn.addEventListener("click", () => this.handleSaveCard());
    }

    // Quality evaluation buttons
    const evaluateCardBtn = document.getElementById("evaluate-card-btn");
    if (evaluateCardBtn) {
      evaluateCardBtn.addEventListener("click", () => this.handleEvaluateCard());
    }
    const optimizeCardBtn = document.getElementById("optimize-card-btn");
    if (optimizeCardBtn) {
      optimizeCardBtn.addEventListener("click", () => this.handleOptimizeCard());
    }

    // Regenerate image button
    const regenerateImageBtn = document.getElementById("regenerate-image-btn");
    regenerateImageBtn.addEventListener("click", () =>
      this.handleRegenerateImage(),
    );

    // Regenerate prompt button
    const regeneratePromptBtn = document.getElementById(
      "regenerate-prompt-btn",
    );
    regeneratePromptBtn.addEventListener("click", () =>
      this.handleRegeneratePrompt(),
    );

    // Field history and lock buttons (delegated)
    document.querySelector('.split-left')?.addEventListener('click', (e) => {
      const histBtn = e.target.closest('.btn-field-history');
      if (histBtn) { this.openFieldHistory(histBtn.dataset.field); return; }

      const lockBtn = e.target.closest('.btn-field-lock');
      if (lockBtn) this.toggleFieldLock(lockBtn.dataset.field, lockBtn);
    });

    // Field history modal close
    document.getElementById('field-history-close-btn')?.addEventListener('click', () => {
      document.getElementById('field-history-modal').classList.remove('show');
      document.body.style.overflow = '';
    });
    document.getElementById('field-history-modal')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        e.currentTarget.classList.remove('show');
        document.body.style.overflow = '';
      }
    });

    // Character field textareas - update model on edit
    const descriptionTextarea = document.getElementById(
      "character-description",
    );
    const personalityTextarea = document.getElementById(
      "character-personality",
    );
    const scenarioTextarea = document.getElementById("character-scenario");
    const firstMessageTextarea = document.getElementById(
      "character-first-message",
    );

    descriptionTextarea.addEventListener("input", () =>
      this.handleCharacterEdit("description"),
    );
    personalityTextarea.addEventListener("input", () =>
      this.handleCharacterEdit("personality"),
    );
    scenarioTextarea.addEventListener("input", () =>
      this.handleCharacterEdit("scenario"),
    );
    firstMessageTextarea.addEventListener("input", () =>
      this.handleCharacterEdit("firstMessage"),
    );

    // Upload image button
    const uploadImageBtn = document.getElementById("upload-image-btn");
    uploadImageBtn.addEventListener("click", () => {
      document.getElementById("image-upload-input").click();
    });

    // Image upload input
    const imageUploadInput = document.getElementById("image-upload-input");
    imageUploadInput.addEventListener("change", (e) =>
      this.handleImageUpload(e),
    );

    // Lorebook upload input
    const lorebookInput = document.getElementById("lorebook-file");
    lorebookInput.addEventListener("change", (e) =>
      this.handleLorebookUpload(e),
    );

    // Reference image upload input
    const referenceImageInput = document.getElementById("reference-image-file");
    if (referenceImageInput) {
      referenceImageInput.addEventListener("change", (e) =>
        this.handleReferenceImageUpload(e),
      );
    }

    // Debug mode toggle
    const debugModeCheckbox = document.getElementById("debug-mode");
    if (debugModeCheckbox) {
      // Load saved debug mode state
      debugModeCheckbox.checked = this.config.getDebugMode();

      // Handle toggle
      debugModeCheckbox.addEventListener("change", (e) => {
        this.config.setDebugMode(e.target.checked);
      });
    }

    // API status click to reconfigure
    const apiStatus = document.getElementById("api-status");
    apiStatus.addEventListener("click", () => this.handleAPIConfig());
    apiStatus.style.cursor = "pointer";

    // Save API settings on input change
    const apiInputs = document.querySelectorAll(
      "#text-api-base, #text-api-key, #text-model, #vision-model, #image-api-base, #image-api-key, #image-model, #st-url, #st-password",
    );
    apiInputs.forEach((input) => {
      input.addEventListener("change", () => this.saveAPISettings());
    });

    // Clear config button
    const clearConfigBtn = document.getElementById("clear-config-btn");
    clearConfigBtn.addEventListener("click", () => this.handleClearConfig());

    // Test connection button
    const testConnectionBtn = document.getElementById("test-connection-btn");
    testConnectionBtn.addEventListener("click", () =>
      this.handleTestConnection(),
    );

    // Enter key in textarea
    const conceptTextarea = document.getElementById("character-concept");
    conceptTextarea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.ctrlKey) {
        e.preventDefault();
        this.handleGenerate();
      }
    });

    // API key persistence toggle
    const persistApiKeysToggle = document.getElementById("persist-api-keys");
    if (persistApiKeysToggle) {
      persistApiKeysToggle.addEventListener("change", (e) => {
        this.config.loadFromForm(); // Update config with new toggle state
        this.config.saveConfig(); // Save the change
        console.log(
          `🔑 API key persistence ${e.target.checked ? "enabled" : "disabled"}`,
        );
      });
    }

    // Image generation toggle
    const enableImageGenerationToggle = document.getElementById(
      "enable-image-generation",
    );
    if (enableImageGenerationToggle) {
      enableImageGenerationToggle.addEventListener("change", (e) => {
        this.config.loadFromForm(); // Update config with new toggle state
        this.config.saveConfig(); // Save the change
        console.log(
          `🖼️ Image generation ${e.target.checked ? "enabled" : "disabled"}`,
        );
      });
    }

    // Debug Response Modal functionality
    const debugResponseBtn = document.getElementById("debug-response-btn");
    const debugResponseModal = document.getElementById("debug-response-modal");
    const debugResponseCloseBtn = document.getElementById("debug-response-close-btn");
    const debugResponseContent = document.getElementById("debug-response-content");

    debugResponseBtn.addEventListener("click", () => {
      const raw = this.apiHandler && this.apiHandler.lastRawResponse;
      const display = raw
        ? (typeof raw === "string" ? raw : JSON.stringify(raw, null, 2))
        : "No response captured yet.";
      debugResponseContent.textContent = display;
      debugResponseModal.classList.add("show");
      document.body.style.overflow = "hidden";
    });

    const closeDebugModal = () => {
      debugResponseModal.classList.remove("show");
      document.body.style.overflow = "";
    };

    debugResponseCloseBtn.addEventListener("click", closeDebugModal);

    debugResponseModal.addEventListener("click", (e) => {
      if (e.target === debugResponseModal) closeDebugModal();
    });

    // API Settings Modal functionality
    const apiSettingsBtn = document.getElementById("api-settings-btn");
    const modalOverlay = document.getElementById("api-settings-modal");
    const modalCloseBtn = document.getElementById("modal-close-btn");

    // Open modal
    apiSettingsBtn.addEventListener("click", () => {
      modalOverlay.classList.add("show");
      document.body.style.overflow = "hidden"; // Prevent background scrolling
    });

    // Close modal function
    const closeModal = () => {
      modalOverlay.classList.remove("show");
      document.body.style.overflow = ""; // Restore scrolling
    };

    // Close modal with close button
    modalCloseBtn.addEventListener("click", closeModal);

    // Close modals with escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (debugResponseModal.classList.contains("show")) closeDebugModal();
        if (modalOverlay.classList.contains("show")) closeModal();
        const hm = document.getElementById("history-modal");
        if (hm?.classList.contains("show")) this.closeHistoryModal();
        const dm = document.getElementById("diff-modal");
        if (dm?.classList.contains("show")) this.closeDiffModal();
        const ld = document.getElementById("library-drawer");
        if (ld?.classList.contains("open")) this.closeLibraryDrawer();
      }
    });

    // Close modal when clicking outside the modal content
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) {
        closeModal();
      }
    });

    const cardList = document.getElementById("stored-cards-list");
    if (cardList) {
      cardList.addEventListener("click", (event) =>
        this.handleLibraryCardClick(event),
      );
    }

    // Example messages generator buttons
    const generateExamplesBtn = document.getElementById(
      "generate-examples-btn",
    );
    const copyExamplesBtn = document.getElementById("copy-examples-btn");

    if (generateExamplesBtn) {
      generateExamplesBtn.addEventListener("click", () =>
        this.handleGenerateExampleMessages(),
      );
    }

    if (copyExamplesBtn) {
      copyExamplesBtn.addEventListener("click", () =>
        this.handleCopyExampleMessages(),
      );
    }

    // Migration banner buttons
    const migratBtn = document.getElementById("migration-migrate-btn");
    const dismissBtn = document.getElementById("migration-dismiss-btn");
    if (migratBtn) {
      migratBtn.addEventListener("click", () => this.handleMigrateCards());
    }
    if (dismissBtn) {
      dismissBtn.addEventListener("click", () => this.dismissMigrationBanner());
    }

    // History modal close
    const historyModal = document.getElementById("history-modal");
    const historyCloseBtn = document.getElementById("history-modal-close-btn");
    if (historyCloseBtn) {
      historyCloseBtn.addEventListener("click", () => this.closeHistoryModal());
    }
    if (historyModal) {
      historyModal.addEventListener("click", (e) => {
        if (e.target === historyModal) this.closeHistoryModal();
      });
    }

    // Diff modal close
    const diffModal = document.getElementById("diff-modal");
    const diffCloseBtn = document.getElementById("diff-modal-close-btn");
    if (diffCloseBtn) {
      diffCloseBtn.addEventListener("click", () => this.closeDiffModal());
    }
    if (diffModal) {
      diffModal.addEventListener("click", (e) => {
        if (e.target === diffModal) this.closeDiffModal();
      });
    }
  }

  async checkMigrationBanner() {
    // Only show if not already dismissed and server storage is active
    if (localStorage.getItem("migrationDismissed")) return;
    if (!(this.storage instanceof ServerBackedStorage)) return;

    try {
      const [existingCards, existingPrompts] = await Promise.all([
        this.storage.listIndexedDBCards(),
        this.storage.listIndexedDBPrompts(),
      ]);
      const hasLegacyData = existingCards.length > 0 || existingPrompts.length > 0;
      if (hasLegacyData) {
        const banner = document.getElementById("migration-banner");
        if (banner) {
          // Update text to reflect what's being migrated
          const textEl = banner.querySelector(".migration-banner-text");
          if (textEl) {
            const parts = [];
            if (existingCards.length > 0) parts.push(`${existingCards.length} card${existingCards.length === 1 ? "" : "s"}`);
            if (existingPrompts.length > 0) parts.push(`${existingPrompts.length} prompt${existingPrompts.length === 1 ? "" : "s"}`);
            textEl.textContent = `You have saved ${parts.join(" and ")} in local browser storage.`;
          }
          banner.style.display = "block";
        }
      }
    } catch {}
  }

  dismissMigrationBanner() {
    localStorage.setItem("migrationDismissed", "1");
    const banner = document.getElementById("migration-banner");
    if (banner) banner.style.display = "none";
  }

  async handleMigrateCards() {
    const migratBtn = document.getElementById("migration-migrate-btn");
    if (migratBtn) {
      migratBtn.disabled = true;
      migratBtn.textContent = "Migrating…";
    }

    try {
      // Migrate cards
      const cards = await this.storage.listIndexedDBCards();
      let migratedCards = 0;
      for (const card of cards) {
        try {
          const full = await this.storage.getIndexedDBCard(card.id);
          if (!full?.character) continue;
          await this.storage.saveCard({
            characterName: full.characterName,
            character: full.character,
            imageBlob: full.imageBlob instanceof Blob ? full.imageBlob : null,
            steeringInput: null,
          });
          await this.storage.deleteIndexedDBCard(card.id);
          migratedCards++;
        } catch (err) {
          console.warn("Failed to migrate card:", card.characterName, err);
        }
      }

      // Migrate prompts
      let migratedPrompts = 0;
      if (this.storage.listIndexedDBPrompts) {
        const prompts = await this.storage.listIndexedDBPrompts();
        for (const prompt of prompts) {
          try {
            const full = await this.storage.getIndexedDBPrompt(prompt.id);
            if (!full) continue;
            // savePrompt expects a record with fingerprint set
            const fingerprint = [
              full.concept || "",
              full.characterName || "",
              full.pov || "",
              full.referenceImageDescription || "",
            ].join("::");
            await this.storage.savePrompt({ ...full, fingerprint });
            await this.storage.deleteIndexedDBPrompt(prompt.id);
            migratedPrompts++;
          } catch (err) {
            console.warn("Failed to migrate prompt:", prompt.characterName, err);
          }
        }
      }

      const parts = [];
      if (migratedCards > 0) parts.push(`${migratedCards} card${migratedCards === 1 ? "" : "s"}`);
      if (migratedPrompts > 0) parts.push(`${migratedPrompts} prompt${migratedPrompts === 1 ? "" : "s"}`);
      const summary = parts.length > 0 ? parts.join(" and ") : "0 items";
      this.showNotification(
        `Migrated ${summary} to server storage.`,
        "success",
      );
      this.dismissMigrationBanner();
      await this.refreshLibraryViews();
    } catch (error) {
      this.showNotification(`Migration failed: ${error.message}`, "error");
      if (migratBtn) {
        migratBtn.disabled = false;
        migratBtn.textContent = "Migrate to Server";
      }
    }
  }

  async checkAPIStatus() {
    const statusElement = document.getElementById("api-status");
    const indicator = statusElement.querySelector(".status-indicator");
    const text = statusElement.querySelector(".status-text");

    try {
      const result = await this.apiHandler.testConnection();
      if (result.success) {
        indicator.className = "status-indicator status-online";
        text.textContent = "API Status: Connected";
      } else {
        indicator.className = "status-indicator status-offline";
        text.textContent = `API Status: ${result.error}`;
      }
    } catch (error) {
      indicator.className = "status-indicator status-offline";
      text.textContent = `API Status: ${error.message}`;
    }
  }

  saveAPISettings() {
    this.config.loadFromForm();
    this.config.saveConfig();
    this.checkAPIStatus();
  }

  async handleAPIConfig() {
    this.showNotification("Configure API settings in form above", "info");
  }

  handleClearConfig() {
    if (confirm("Are you sure you want to clear all saved API settings?")) {
      this.config.clearStoredConfig();
      this.showNotification(
        "Configuration cleared! Reloading page...",
        "success",
      );
      // Reload page to reset everything to defaults
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
  }

  async handleTestConnection() {
    this.showNotification("Testing connection...", "info");

    try {
      // Save current settings first
      this.saveAPISettings();

      // Test connection
      const result = await this.apiHandler.testConnection();

      if (result.success) {
        if (result.authMethod === "alternative") {
          this.showNotification(
            "Connection successful with alternative auth method! Check console for details.",
            "success",
          );
        } else {
          this.showNotification("Connection successful!", "success");
        }
      } else {
        if (
          result.error.includes("401") ||
          result.error.includes("Authorization")
        ) {
          this.showNotification(
            "Authorization failed! Possible issues: 1) API key expired/invalid 2) Wrong auth format - trying alternatives 3) Check API key and try again",
            "error",
          );
        } else {
          this.showNotification(`Connection failed: ${result.error}`, "error");
        }
      }
    } catch (error) {
      this.showNotification(
        `Connection test failed: ${error.message}`,
        "error",
      );
    }
  }

  async handleGenerate() {
    if (this.isGenerating) return;

    // Save current API settings
    this.saveAPISettings();

    // Validate configuration
    const errors = this.config.validateConfig();
    if (errors.length > 0) {
      this.showNotification(
        `Configuration errors: ${errors.join(", ")}`,
        "error",
      );
      return;
    }

    const concept = document.getElementById("character-concept").value.trim();
    const characterName = document
      .getElementById("character-name")
      .value.trim();
    const referenceImageDescription = document
      .getElementById("reference-image-description")
      ?.value?.trim();

    if (!concept) {
      this.showNotification("Please enter a character concept", "warning");
      return;
    }

    // Snapshot current field values for change highlighting after generation
    const prevFieldValues = this.currentCharacter
      ? {
          description: this.currentCharacter.description || "",
          personality: this.currentCharacter.personality || "",
          scenario: this.currentCharacter.scenario || "",
          firstMessage: this.currentCharacter.firstMessage || "",
        }
      : null;

    this.isGenerating = true;
    this.setGeneratingState(true);
    this.clearStream();

    try {
      // Show stream section
      const streamSection = document.querySelector(".stream-section");
      streamSection.style.display = "block";

      const pov = document.getElementById("pov-select").value;
      let effectiveConcept = concept;

      if (referenceImageDescription) {
        effectiveConcept += `\n\nReference appearance guidance:\n${referenceImageDescription}`;
      }

      // Expand @mentions into referenced card context
      if (typeof expandMentions === "function") {
        effectiveConcept = await expandMentions(effectiveConcept, this.storage);
      }

      // Generate character data with streaming
      this.showStreamMessage("🚀 Starting character generation...\n\n");
      this.currentCharacter = await this.characterGenerator.generateCharacter(
        effectiveConcept,
        characterName,
        (token, fullContent) => this.handleCharacterStream(token, fullContent),
        pov,
        this.lorebookData,
      );

      // Store original for reset functionality
      this.originalCharacter = JSON.parse(
        JSON.stringify(this.currentCharacter),
      );
      await this.saveCardToLibrary(concept);
      await this.refreshLibraryViews();

      this.showStreamMessage("\n\n✅ Character generation complete!\n");

      // Display character and highlight changed fields
      this.displayCharacter();
      if (prevFieldValues) {
        this.highlightChangedFields(prevFieldValues);
        this._lastPrevFieldValues = prevFieldValues;
        this._showChangesLink(prevFieldValues);
      } else {
        this._lastPrevFieldValues = null;
        this._removeChangesLink();
      }

      // Check if image generation is configured and enabled
      const imageApiBase = this.config.get("api.image.baseUrl");
      const imageApiKey = this.config.get("api.image.apiKey");
      const enableImageGeneration = this.config.get(
        "app.enableImageGeneration",
      );
      const hasReferenceImage = !!this.referenceImageDataUrl;

      if (hasReferenceImage) {
        this.currentImageUrl = this.referenceImageDataUrl;
        const imageContainer = document.getElementById("image-content");
        imageContainer.innerHTML = `
          <div class="image-container">
            <img src="${this.currentImageUrl}" alt="${this.currentCharacter.name || "Reference image"}" class="generated-image">
          </div>
        `;
        this.showStreamMessage(
          "🖼️ Using uploaded reference image as final card image (skipped image API generation)\n",
        );
      } else if (imageApiBase && imageApiKey && enableImageGeneration) {
        // Generate image with error handling
        try {
          this.showStreamMessage("🎨 Generating character image...\n");
          await this.generateImage();
          this.showStreamMessage("✅ Image generation complete!\n");
        } catch (imageError) {
          console.error("Image generation error:", imageError);
          this.showStreamMessage(
            `⚠️ Image generation failed: ${imageError.message}\n`,
          );
          this.showStreamMessage("📝 Continuing with character data only...\n");
          // Show placeholder with upload option
          const imageContainer = document.getElementById("image-content");
          imageContainer.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
              <p>Image generation failed</p>
              <p style="font-size: 0.875rem; margin-top: 0.5rem; color: var(--error);">${imageError.message}</p>
              <p style="font-size: 0.875rem; margin-top: 0.5rem;">You can upload your own image</p>
            </div>
          `;
        }
      } else {
        this.showStreamMessage(
          "⏭️ Skipping image generation (image generation disabled or no API configured)\n",
        );
        // Show placeholder with upload option when image generation is disabled
        const imageContainer = document.getElementById("image-content");
        imageContainer.innerHTML = `
          <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
            <div style="font-size: 2rem; margin-bottom: 1rem;">🖼️</div>
            <p style="font-weight: 500; margin-bottom: 0.5rem;">Image Generation Disabled</p>
            <p style="font-size: 0.875rem; margin-bottom: 1rem;">Enable image generation in settings or upload your own image</p>
            <button onclick="document.getElementById('upload-image-btn').click()" style="padding: 0.5rem 1rem; background: var(--accent); color: white; border: none; border-radius: 0.375rem; cursor: pointer;">
              📁 Upload Image
            </button>
          </div>
        `;
      }

      // Show result section and image controls
      this.showResultSection();
      document.getElementById("image-controls").style.display = "block";

      // Always show prompt editor when image API is configured (regardless of generation setting)
      if (imageApiBase && imageApiKey) {
        const promptEditor = document.getElementById("image-prompt-editor");
        const customPromptTextarea = document.getElementById(
          "custom-image-prompt",
        );
        const referenceDescription = document
          .getElementById("reference-image-description")
          ?.value?.trim();

        if (promptEditor) {
          promptEditor.style.display = "block";

          if (
            customPromptTextarea &&
            referenceDescription &&
            !customPromptTextarea.value.trim()
          ) {
            customPromptTextarea.value = `Character portrait of ${this.currentCharacter.name || "the character"}, based on this reference description: ${referenceDescription}. High quality, detailed features, cinematic lighting, coherent anatomy, expressive face, fitting background.`;
            window.updatePromptCharCount();
          }

          if (
            customPromptTextarea &&
            window.apiHandler.lastGeneratedImagePrompt
          ) {
            // Use the previously generated prompt
            customPromptTextarea.value =
              window.apiHandler.lastGeneratedImagePrompt;
            // Update character counter
            window.updatePromptCharCount();
          } else if (
            !hasReferenceImage &&
            customPromptTextarea &&
            !customPromptTextarea.value.trim()
          ) {
            // Generate prompt only if needed and no reference image was provided.
            try {
              const defaultPrompt = await window.apiHandler.generateImagePrompt(
                this.currentCharacter.description,
                this.currentCharacter.name,
              );
              customPromptTextarea.value = defaultPrompt;
            } catch (error) {
              console.error("Failed to generate image prompt:", error);
              // Fall back to direct prompt building
              const fallbackPrompt = window.apiHandler.buildDirectImagePrompt(
                this.currentCharacter.description,
                this.currentCharacter.name,
              );
              customPromptTextarea.value = fallbackPrompt;
            }
            window.updatePromptCharCount();
          }
        }
      }

      this.showNotification("Character generated successfully!", "success");

      // Auto-switch to Editor tab if user is still on Create
      if (this.activeTab === 'create') {
        this.switchTab('editor');
      } else {
        this.notifyTab('editor');
      }
    } catch (error) {
      console.error("Generation error:", error);

      // Check if this was a user-initiated stop
      const wasStoppedByUser = error.message.includes(
        "Generation stopped by user",
      );

      if (wasStoppedByUser) {
        this.showStreamMessage(`\n🛑 Generation stopped.\n`);
        // Don't show error notification for user-initiated stops
      } else {
        this.showStreamMessage(`❌ Error: ${error.message}\n`);
        this.showNotification(`Generation failed: ${error.message}`, "error");
      }

      // Hide result section if generation failed
      this.hideResultSection();
    } finally {
      this.isGenerating = false;
      this.setGeneratingState(false);
    }
  }

  handleCharacterStream(token, fullContent) {
    // Append token to stream
    this.appendStreamContent(token);
  }

  showStreamMessage(message) {
    const streamContent = document.getElementById("stream-content");
    const messageElement = document.createElement("div");
    messageElement.textContent = message;
    streamContent.appendChild(messageElement);
    streamContent.scrollTop = streamContent.scrollHeight;
  }

  appendStreamContent(content) {
    const streamContent = document.getElementById("stream-content");

    // Remove placeholder if it exists
    const placeholder = streamContent.querySelector(".stream-placeholder");
    if (placeholder) {
      placeholder.remove();
    }

    // Check if last child is content container
    let contentContainer = streamContent.querySelector(".stream-content");
    if (!contentContainer) {
      contentContainer = document.createElement("div");
      contentContainer.className = "stream-content";
      streamContent.appendChild(contentContainer);
    }

    // Append new content
    contentContainer.textContent += content;
    streamContent.scrollTop = streamContent.scrollHeight;
  }

  clearStream() {
    const streamContent = document.getElementById("stream-content");
    streamContent.innerHTML =
      '<div class="stream-placeholder">Generation output will appear here...</div>';
  }

  async handleDownload() {
    if (!this.currentCharacter || !this.currentImageUrl) {
      this.showNotification("No character to download", "warning");
      return;
    }

    try {
      this.showNotification("Creating character card...", "info");

      // Sync editor fields into currentCharacter
      this.syncFieldsFromEditor();

      // Always convert from currentImageUrl to ensure we get the latest image
      // This ensures regenerated or uploaded images are properly included

      let imageBlob = await this.imageGenerator.convertToBlob(
        this.currentImageUrl,
      );

      // Use image as-is without resizing
      imageBlob = await this.imageGenerator.optimizeImageForCard(imageBlob);

      // Convert to Spec V2 format
      const specV2Data = this.characterGenerator.toSpecV2Format(
        this.currentCharacter,
      );

      // Create character card
      const cardBlob = await this.pngEncoder.createCharacterCard(
        imageBlob,
        specV2Data,
      );
      // You can uncomment this to see a preview modal before download
      /*
      const shouldDownload = confirm(
        "PNG created! Click OK to download, or Cancel to preview in console first.\n\n" +
        "Check the browser console for preview URLs."
      );
      if (!shouldDownload) {
        this.showNotification("Download cancelled", "info");
        return;
      }
      */

      // Download
      this.pngEncoder.downloadCharacterCard(
        cardBlob,
        this.currentCharacter.name,
      );

      const finalSize = this.imageGenerator.formatFileSize(cardBlob.size);
      this.showNotification(
        `Character card downloaded! Size: ${finalSize}`,
        "success",
      );
      await this.saveCardToLibrary();
      await this.refreshLibraryViews();
    } catch (error) {
      console.error("Download error:", error);
      this.showNotification(`Download failed: ${error.message}`, "error");
    }
  }

  async handleRegeneratePrompt() {
    if (!this.currentCharacter) {
      this.showNotification("Please generate a character first", "warning");
      return;
    }

    const customPromptTextarea = document.getElementById("custom-image-prompt");
    const promptEditor = document.getElementById("image-prompt-editor");

    if (!customPromptTextarea || !promptEditor) {
      this.showNotification("Prompt editor not found", "error");
      return;
    }

    try {
      this.showNotification("Regenerating image prompt...", "info");
      // Use AI to generate a detailed natural language prompt
      const newPrompt = await window.apiHandler.generateImagePrompt(
        this.currentCharacter.description,
        this.currentCharacter.name,
      );
      customPromptTextarea.value = newPrompt;
      // Update character counter
      window.updatePromptCharCount();
      this.showNotification("Image prompt regenerated!", "success");
    } catch (error) {
      console.error("Failed to regenerate image prompt:", error);
      // Fall back to direct prompt building
      const fallbackPrompt = window.apiHandler.buildDirectImagePrompt(
        this.currentCharacter.description,
        this.currentCharacter.name,
      );
      customPromptTextarea.value = fallbackPrompt;
      window.updatePromptCharCount();
      this.showNotification("Using fallback prompt generation", "warning");
    }

    // Ensure prompt editor is visible
    promptEditor.style.display = "block";
  }

  async handleRegenerateImage() {
    if (!this.currentCharacter) {
      this.showNotification("Please generate a character first", "warning");
      return;
    }

    const imageApiBase = this.config.get("api.image.baseUrl");
    const imageApiKey = this.config.get("api.image.apiKey");

    if (!imageApiBase || !imageApiKey) {
      this.showNotification(
        "Please configure image API settings first",
        "warning",
      );
      return;
    }

    // Show the prompt editor and populate it with the default prompt
    const promptEditor = document.getElementById("image-prompt-editor");
    const customPromptTextarea = document.getElementById("custom-image-prompt");

    if (promptEditor && customPromptTextarea) {
      // Generate the default prompt if not already populated
      if (!customPromptTextarea.value.trim()) {
        try {
          this.showNotification("Generating image prompt...", "info");
          // Use AI to generate a detailed natural language prompt
          const defaultPrompt = await window.apiHandler.generateImagePrompt(
            this.currentCharacter.description,
            this.currentCharacter.name,
          );
          customPromptTextarea.value = defaultPrompt;
          // Update character counter
          window.updatePromptCharCount();
        } catch (error) {
          console.error("Failed to generate image prompt:", error);
          // Fall back to direct prompt building
          const fallbackPrompt = window.apiHandler.buildDirectImagePrompt(
            this.currentCharacter.description,
            this.currentCharacter.name,
          );
          customPromptTextarea.value = fallbackPrompt;
          // Update character counter
          window.updatePromptCharCount();
        }
      }
      promptEditor.style.display = "block";
    }

    try {
      this.showNotification("Regenerating image...", "info");
      await this.generateImage();
      this.showNotification("Image regenerated successfully!", "success");
    } catch (error) {
      console.error("Image regeneration error:", error);
      this.showNotification(
        `Image regeneration failed: ${error.message}`,
        "error",
      );
    }
  }

  async generateImage() {
    const imageContainer = document.getElementById("image-content");

    // Check if user has provided a custom prompt
    const customPromptTextarea = document.getElementById("custom-image-prompt");
    const customPrompt = customPromptTextarea?.value?.trim();
    const referenceImageDescription = document
      .getElementById("reference-image-description")
      ?.value?.trim();

    // Update character counter
    window.updatePromptCharCount();

    // Clean up previous blob URL if it exists
    if (this.currentImageUrl && this.currentImageUrl.startsWith("blob:")) {
      console.log("🗑️ Revoking previous blob URL:", this.currentImageUrl);
      URL.revokeObjectURL(this.currentImageUrl);
    }

    const imageDescriptionInput = referenceImageDescription
      ? `${this.currentCharacter.description}\n\nReference image details:\n${referenceImageDescription}`
      : this.currentCharacter.description;
    const promptFromReference = referenceImageDescription
      ? `Character portrait of ${this.currentCharacter.name || "the character"}, based on this reference description: ${referenceImageDescription}. High quality, detailed features, cinematic lighting, coherent anatomy, expressive face, fitting background.`
      : "";
    const effectivePrompt = customPrompt || promptFromReference || null;

    const imageResult = await this.imageGenerator.generateAndDisplayImage(
      imageDescriptionInput,
      this.currentCharacter.name,
      imageContainer,
      effectivePrompt,
    );

    // Extract URL from the result object
    this.currentImageUrl = imageResult.url || imageResult;

    // If no custom prompt was provided, populate textarea with auto-generated prompt
    if (
      !customPrompt &&
      customPromptTextarea &&
      window.apiHandler.lastGeneratedImagePrompt
    ) {
      customPromptTextarea.value = window.apiHandler.lastGeneratedImagePrompt;
      console.log("Updated custom prompt textarea with auto-generated prompt");
    }

    // Note: We don't store blob here anymore - download converts fresh from URL
    // This ensures regenerated images are properly included in downloads
  }

  async handleDownloadJSON() {
    if (!this.currentCharacter) {
      this.showNotification("No character to download", "warning");
      return;
    }

    try {
      this.showNotification("Preparing character JSON...", "info");

      // Sync editor fields into currentCharacter
      this.syncFieldsFromEditor();

      // Convert to Spec V2 format
      const specV2Data = this.characterGenerator.toSpecV2Format(
        this.currentCharacter,
      );

      // Create JSON string with nice formatting
      const jsonString = JSON.stringify(specV2Data, null, 2);

      // Create blob and download
      const blob = new Blob([jsonString], { type: "application/json" });
      this.downloadBlob(
        blob,
        `${this.currentCharacter.name || "character"}_data.json`,
      );

      this.showNotification(
        "Character JSON downloaded successfully!",
        "success",
      );
      await this.saveCardToLibrary();
      await this.refreshLibraryViews();
    } catch (error) {
      console.error("Error downloading JSON:", error);
      this.showNotification("Failed to download JSON", "error");
    }
  }

  // --- SillyTavern Integration ---

  getSTHeaders() {
    const stUrl = this.config.get("api.sillytavern.url");
    const stPassword = this.config.get("api.sillytavern.password") || "";
    const headers = {
      "Content-Type": "application/json",
      "X-ST-URL": stUrl,
    };
    if (stPassword) {
      headers["X-ST-Password"] = stPassword;
    }
    return headers;
  }

  async handlePushToST() {
    const stUrl = this.config.get("api.sillytavern.url");
    if (!stUrl) {
      this.showNotification(
        "Configure SillyTavern URL in settings first",
        "warning",
      );
      return;
    }

    if (!this.currentCharacter) {
      this.showNotification("No character to push", "warning");
      return;
    }

    try {
      this.showNotification("Pushing to SillyTavern...", "info");

      // Sync editor fields into currentCharacter
      this.syncFieldsFromEditor();

      const specV2Data = this.characterGenerator.toSpecV2Format(this.currentCharacter);
      const name = this.currentCharacter.name || "character";

      let body;
      if (this.currentImageUrl) {
        // PNG with embedded character data
        let imageBlob = await this.imageGenerator.convertToBlob(this.currentImageUrl);
        imageBlob = await this.imageGenerator.optimizeImageForCard(imageBlob);
        const cardBlob = await this.pngEncoder.createCharacterCard(imageBlob, specV2Data);
        const arrayBuffer = await cardBlob.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(arrayBuffer).reduce(
            (data, byte) => data + String.fromCharCode(byte),
            "",
          ),
        );
        body = { imageBase64: base64, fileName: `${name}.png` };
      } else {
        // No image — push as JSON character card
        body = { characterJson: specV2Data, fileName: `${name}.json` };
      }

      const response = await fetch("/api/st/push", {
        method: "POST",
        headers: this.getSTHeaders(),
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || "Push failed");
      }

      const result = await response.json();
      this.showNotification(
        `Pushed "${result.name || this.currentCharacter.name}" to SillyTavern!`,
        "success",
      );
    } catch (error) {
      console.error("ST push error:", error);
      this.showNotification(
        `Push to SillyTavern failed: ${error.message}`,
        "error",
      );
    }
  }

  async handlePullFromST() {
    const stUrl = this.config.get("api.sillytavern.url");
    if (!stUrl) {
      this.showNotification(
        "Configure SillyTavern URL in settings first",
        "warning",
      );
      return;
    }

    const modal = document.getElementById("st-browser-modal");
    const listEl = document.getElementById("st-characters-list");

    // Show modal with loading state
    listEl.innerHTML =
      '<p style="color: var(--text-secondary)">Loading characters...</p>';
    modal.classList.add("show");
    document.body.style.overflow = "hidden";

    try {
      const response = await fetch("/api/st/characters", {
        method: "POST",
        headers: this.getSTHeaders(),
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || "Failed to list characters");
      }

      const characters = await response.json();

      if (!characters || characters.length === 0) {
        listEl.innerHTML =
          '<p style="color: var(--text-secondary)">No characters found.</p>';
        return;
      }

      // Shared body-level tooltip (avoids overflow/transform clipping)
      let sharedTooltip = document.getElementById("st-tag-shared-tooltip");
      if (!sharedTooltip) {
        sharedTooltip = document.createElement("div");
        sharedTooltip.id = "st-tag-shared-tooltip";
        sharedTooltip.className = "st-tag-tooltip";
        document.body.appendChild(sharedTooltip);
      }

      // Render character list with search
      const renderList = (filter = "") => {
        listEl.innerHTML = "";
        const lower = filter.toLowerCase();
        const filtered = characters.filter((char) => {
          const name = char.name || char.avatar?.replace(".png", "") || "";
          const tags = char.tags || [];
          return (
            name.toLowerCase().includes(lower) ||
            tags.some((t) => t.toLowerCase().includes(lower))
          );
        });

        if (filtered.length === 0) {
          listEl.innerHTML = '<p style="color: var(--text-secondary)">No characters match.</p>';
          return;
        }

        filtered.forEach((char) => {
          const name = char.name || char.avatar?.replace(".png", "") || "Unknown";
          const avatar = char.avatar || "";
          const tags = char.tags || [];

          const truncTag = (t) => t.length > 10 ? this.escapeHtml(t.slice(0, 10)) + "…" : this.escapeHtml(t);

          // Sort tags by length (shortest first) to fit more
          const sorted = [...tags].sort((a, b) => a.length - b.length);

          // Use a wrapper div so tags/tooltip aren't inside the button
          const row = document.createElement("div");
          row.className = "st-char-item btn-outline";

          const nameBtn = document.createElement("span");
          nameBtn.className = "st-char-name";
          nameBtn.textContent = name;

          const tagsEl = document.createElement("span");
          tagsEl.className = "st-char-tags";

          // Add all tags as hidden spans, then measure which fit
          sorted.forEach((t) => {
            const tagSpan = document.createElement("span");
            tagSpan.className = "tag";
            tagSpan.textContent = t.length > 10 ? t.slice(0, 10) + "…" : t;
            tagsEl.appendChild(tagSpan);
          });

          row.appendChild(nameBtn);
          row.appendChild(tagsEl);
          row.addEventListener("click", () =>
            this.handlePullCharacter(avatar, name, modal),
          );
          listEl.appendChild(row);

          // Measure which tags fit, remove overflow, add +N
          if (sorted.length > 0) {
            const tagSpans = tagsEl.querySelectorAll(".tag");
            const containerRight = tagsEl.getBoundingClientRect().right;
            let fittingCount = 0;

            for (let i = 0; i < tagSpans.length; i++) {
              if (tagSpans[i].getBoundingClientRect().right > containerRight) break;
              fittingCount++;
            }

            if (fittingCount < sorted.length) {
              // Add +N badge first (hidden) to measure its width, then back off
              // enough visible tags so the badge itself fits too
              const moreEl = document.createElement("span");
              moreEl.className = "st-tag-more";
              moreEl.style.visibility = "hidden";
              moreEl.textContent = `+${sorted.length - fittingCount}`;
              tagsEl.appendChild(moreEl);
              const moreWidth = moreEl.getBoundingClientRect().width;
              tagsEl.removeChild(moreEl);
              moreEl.style.visibility = "";

              // Back off visible tags until there's room for the badge
              while (fittingCount > 0 && tagSpans[fittingCount - 1].getBoundingClientRect().right + moreWidth > containerRight) {
                fittingCount--;
              }
              moreEl.textContent = `+${sorted.length - fittingCount}`;

              // Remove tags that don't fit
              for (let i = tagSpans.length - 1; i >= fittingCount; i--) {
                tagSpans[i].remove();
              }
              const hiddenTags = sorted.slice(fittingCount);
              moreEl.addEventListener("mouseenter", (e) => {
                sharedTooltip.innerHTML = hiddenTags.map((t) => `<span class="tag">${this.escapeHtml(t)}</span>`).join("");
                sharedTooltip.style.top = `${e.clientY}px`;
                sharedTooltip.style.left = `${Math.max(10, e.clientX - 220)}px`;
                sharedTooltip.classList.add("visible");
              });
              moreEl.addEventListener("mouseleave", () => {
                sharedTooltip.classList.remove("visible");
              });
              tagsEl.appendChild(moreEl);
            }
          }
        });
      };

      renderList();

      const searchInput = document.getElementById("st-search");
      searchInput.value = "";
      searchInput.oninput = (e) => renderList(e.target.value);
    } catch (error) {
      console.error("ST list error:", error);
      listEl.innerHTML = `<p style="color: var(--error)">Error: ${this.escapeHtml(error.message)}</p>`;
    }
  }

  async handlePullCharacter(avatarUrl, name, modal) {
    try {
      this.showNotification(`Pulling "${name}" from SillyTavern...`, "info");

      const response = await fetch("/api/st/pull", {
        method: "POST",
        headers: this.getSTHeaders(),
        body: JSON.stringify({ avatar_url: avatarUrl }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || "Pull failed");
      }

      const data = await response.json();

      // Normalize the character from ST's export format
      const characterData = this.normalizeCharacterFromSpec(data);
      this.currentCharacter = characterData;
      this.originalCharacter = JSON.parse(JSON.stringify(characterData));

      // Display the character (reads from this.currentCharacter)
      this.displayCharacter();
      this.showResultSection();

      // Show image controls
      document.getElementById("image-controls").style.display = "block";

      // Close modal and switch to Editor tab
      modal.classList.remove("show");
      document.body.style.overflow = "";
      this.switchTab('editor');

      this.showNotification(
        `Pulled "${name}" from SillyTavern!`,
        "success",
      );

      // Fetch the avatar image from SillyTavern via proxy
      if (avatarUrl) {
        try {
          const stUrl = this.config.get("api.sillytavern.url");
          const avatarImageUrl = `${stUrl}/characters/${avatarUrl}`;
          const imgResponse = await fetch(
            `/api/proxy-image?url=${encodeURIComponent(avatarImageUrl)}`,
          );
          if (imgResponse.ok) {
            const blob = await imgResponse.blob();
            if (this.currentImageUrl && this.currentImageUrl.startsWith("blob:")) {
              URL.revokeObjectURL(this.currentImageUrl);
            }
            this.currentImageUrl = URL.createObjectURL(blob);
            const imageContainer = document.getElementById("image-content");
            imageContainer.innerHTML = `
              <div class="image-container">
                <img src="${this.currentImageUrl}" alt="${this.escapeHtml(name)}" class="generated-image">
              </div>
            `;
          }
        } catch (imgError) {
          console.warn("Could not fetch avatar image from SillyTavern:", imgError);
        }
      }
    } catch (error) {
      console.error("ST pull error:", error);
      this.showNotification(
        `Pull failed: ${error.message}`,
        "error",
      );
    }
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  handleCharacterEdit(field) {
    if (!this.currentCharacter) return;

    const textareaMap = {
      description: "character-description",
      personality: "character-personality",
      scenario: "character-scenario",
      firstMessage: "character-first-message",
    };

    const textarea = document.getElementById(textareaMap[field]);
    if (!textarea) return;

    this.currentCharacter[field] = textarea.value;
    textarea.classList.remove("field-changed");
  }

  async handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!this.currentCharacter) {
      this.showNotification("Please generate a character first", "warning");
      event.target.value = ""; // Reset input
      return;
    }

    try {
      // Validate image file
      if (!file.type.startsWith("image/")) {
        throw new Error("Please select an image file");
      }

      // Clean up previous blob URL if it exists
      if (this.currentImageUrl && this.currentImageUrl.startsWith("blob:")) {
        URL.revokeObjectURL(this.currentImageUrl);
        console.log("🗑️ Revoked previous blob URL:", this.currentImageUrl);
      }

      // Create object URL for the uploaded image
      this.currentImageUrl = URL.createObjectURL(file);

      // Display the uploaded image
      const imageContainer = document.getElementById("image-content");
      imageContainer.innerHTML = `
        <div class="image-container">
          <img src="${this.currentImageUrl}" alt="${this.currentCharacter.name}" class="generated-image">
        </div>
      `;

      this.showNotification("Image uploaded successfully!", "success");
      await this.saveCardToLibrary();
      await this.refreshLibraryViews();
    } catch (error) {
      console.error("Image upload error:", error);
      this.showNotification(`Image upload failed: ${error.message}`, "error");
    } finally {
      event.target.value = ""; // Reset input
    }
  }

  // Helper method to download blobs
  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  handleRegenerate() {
    // Instead of just clearing, automatically trigger generation again
    this.hideResultSection();
    this.clearStream();
    this.switchTab('create');
    this.currentCharacter = null;
    this.currentCardSlug = null;
    this.currentImageUrl = null;
    document.getElementById("image-controls").style.display = "none";

    // Clear image content and prompt editor
    const imageContent = document.getElementById("image-content");
    const promptEditor = document.getElementById("image-prompt-editor");
    const customPromptTextarea = document.getElementById("custom-image-prompt");

    if (imageContent) {
      imageContent.innerHTML = `
        <div class="image-placeholder">
          <div class="loading-spinner"></div>
        </div>
      `;
    }

    if (promptEditor) {
      promptEditor.style.display = "none";
    }

    if (customPromptTextarea) {
      customPromptTextarea.value = "";
      window.updatePromptCharCount();
    }

    // Auto-trigger generation with the same inputs
    const concept = document.getElementById("character-concept").value.trim();
    if (concept) {
      this.showNotification("Regenerating character...", "info");
      // Small delay to allow UI to update
      setTimeout(() => {
        this.handleGenerate();
      }, 100);
    } else {
      // If no concept, just focus on the input
      document.getElementById("character-concept").focus();
      this.showNotification(
        "Please enter a character concept first",
        "warning",
      );
    }
  }

  setGeneratingState(isGenerating) {
    const generateBtn = document.getElementById("generate-btn");
    const stopBtn = document.getElementById("stop-btn");
    const btnText = generateBtn.querySelector(".btn-text");
    const btnLoading = generateBtn.querySelector(".btn-loading");
    const progressBar = document.getElementById("generation-progress");

    if (isGenerating) {
      generateBtn.disabled = true;
      btnText.style.display = "none";
      btnLoading.style.display = "inline";
      stopBtn.style.display = "inline-block";
      if (progressBar) progressBar.style.display = "block";
      this.clearFieldHighlights();
      this._removeChangesLink();
    } else {
      generateBtn.disabled = false;
      btnText.style.display = "inline";
      btnLoading.style.display = "none";
      stopBtn.style.display = "none";
      if (progressBar) progressBar.style.display = "none";
    }
  }

  clearFieldHighlights() {
    ["character-description", "character-personality", "character-scenario", "character-first-message"].forEach((id) => {
      document.getElementById(id)?.classList.remove("field-changed");
    });
  }

  highlightChangedFields(prevValues) {
    const fieldMap = {
      description: "character-description",
      personality: "character-personality",
      scenario: "character-scenario",
      firstMessage: "character-first-message",
    };
    for (const [field, elemId] of Object.entries(fieldMap)) {
      const el = document.getElementById(elemId);
      if (!el) continue;
      const prev = (prevValues[field] || "").trim();
      const next = (this.currentCharacter[field] || "").trim();
      if (prev && next && prev !== next) {
        el.classList.add("field-changed");
      }
    }
  }

  handleStop() {
    if (this.isGenerating) {
      this.showStreamMessage("\n\n🛑 Stopping generation...\n");
      window.apiHandler.stopGeneration();
      this.isGenerating = false;
      this.setGeneratingState(false);
      this.showNotification("Generation stopped by user", "warning");
    }
  }

  syncFieldsFromEditor() {
    if (!this.currentCharacter) return;
    const desc = document.getElementById("character-description");
    const pers = document.getElementById("character-personality");
    const scen = document.getElementById("character-scenario");
    const first = document.getElementById("character-first-message");
    if (desc) this.currentCharacter.description = desc.value.trim();
    if (pers) this.currentCharacter.personality = pers.value.trim();
    if (scen) this.currentCharacter.scenario = scen.value.trim();
    if (first) this.currentCharacter.firstMessage = first.value.trim();

    const mesEx = document.getElementById("example-messages-output");
    if (mesEx) {
      const text = (mesEx.innerText || mesEx.textContent || "").trim();
      if (text) this.currentCharacter.mesExample = text;
    }
  }

  displayCharacter() {
    // Update all character fields
    const descriptionTextarea = document.getElementById(
      "character-description",
    );
    const personalityTextarea = document.getElementById(
      "character-personality",
    );
    const scenarioTextarea = document.getElementById("character-scenario");
    const firstMessageTextarea = document.getElementById(
      "character-first-message",
    );

    descriptionTextarea.value = this.currentCharacter.description || "";
    personalityTextarea.value = this.currentCharacter.personality || "";
    scenarioTextarea.value = this.currentCharacter.scenario || "";
    firstMessageTextarea.value = this.currentCharacter.firstMessage || "";

    // Reset example messages section for new character
    const exampleMessagesOutput = document.getElementById(
      "example-messages-output",
    );
    const copyExamplesBtn = document.getElementById("copy-examples-btn");
    if (exampleMessagesOutput) {
      exampleMessagesOutput.textContent = "";
    }
    if (copyExamplesBtn) {
      copyExamplesBtn.style.display = "none";
    }

    // Show JSON download button whenever character data is available
    const downloadJsonBtn = document.getElementById("download-json-btn");
    if (downloadJsonBtn) {
      downloadJsonBtn.style.display = "inline-flex";
    }
  }

  showResultSection() {
    this.enableEditorTab();
    const downloadBtn = document.getElementById("download-btn");
    const downloadJsonBtn = document.getElementById("download-json-btn");

    if (downloadBtn) downloadBtn.style.display = "inline-flex";

    // Show JSON download button when character data is available
    if (downloadJsonBtn && this.currentCharacter) {
      downloadJsonBtn.style.display = "inline-flex";
    }

    // Show push to ST button if ST is configured
    const pushStBtn = document.getElementById("push-st-btn");
    if (pushStBtn && this.config.get("api.sillytavern.url")) {
      pushStBtn.style.display = "inline-flex";
    }

    const saveCardBtn = document.getElementById("save-card-btn");
    if (saveCardBtn) saveCardBtn.style.display = "inline-flex";
  }

  hideResultSection() {
    const downloadBtn = document.getElementById("download-btn");
    const downloadJsonBtn = document.getElementById("download-json-btn");

    if (downloadBtn) downloadBtn.style.display = "none";
    if (downloadJsonBtn) downloadJsonBtn.style.display = "none";
    const pushStBtn = document.getElementById("push-st-btn");
    if (pushStBtn) pushStBtn.style.display = "none";
    const saveCardBtn = document.getElementById("save-card-btn");
    if (saveCardBtn) saveCardBtn.style.display = "none";
  }

  async handleReferenceImageUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      this.imageGenerator.validateImageFile(file);

      const dataUrl = await this.prepareReferenceImageForVision(file);

      this.referenceImageDataUrl = dataUrl;
      this.updateReferenceImagePreview(dataUrl);

      const descriptionField = document.getElementById(
        "reference-image-description",
      );
      const hint = descriptionField?.value?.trim() || "";

      this.showNotification("Analyzing reference image...", "info");
      const imageDescription = await this.apiHandler.describeReferenceImage(
        dataUrl,
        hint,
      );
      if (descriptionField) {
        descriptionField.value = imageDescription;
      }
      this.showNotification("Reference image description generated", "success");
    } catch (error) {
      console.error("Reference image handling failed:", error);
      this.showNotification(
        `Reference image analysis failed: ${error.message}`,
        "warning",
      );
    } finally {
      event.target.value = "";
    }
  }

  async prepareReferenceImageForVision(file) {
    const sourceDataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () =>
        reject(new Error("Failed to read reference image file"));
      reader.readAsDataURL(file);
    });

    // Resize/compress before sending to vision to avoid payload-too-large errors.
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Failed to process image"));
      image.src = sourceDataUrl;
    });

    const maxSide = 1024;
    const ratio = Math.min(maxSide / img.width, maxSide / img.height, 1);
    const targetWidth = Math.max(1, Math.round(img.width * ratio));
    const targetHeight = Math.max(1, Math.round(img.height * ratio));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    return canvas.toDataURL("image/jpeg", 0.82);
  }

  updateReferenceImagePreview(dataUrl) {
    const preview = document.getElementById("reference-image-preview");
    if (!preview) return;

    preview.style.display = "block";
    preview.innerHTML = `<img src="${dataUrl}" alt="Reference image" style="width: 100%; display: block;" />`;
  }

  normalizeCharacterFromSpec(specData) {
    if (specData?.data) {
      return {
        name: specData.data.name || "Unnamed Character",
        description: specData.data.description || "",
        personality: specData.data.personality || "",
        scenario: specData.data.scenario || "",
        firstMessage: specData.data.first_mes || "",
      };
    }

    return {
      name: specData.name || "Unnamed Character",
      description: specData.description || "",
      personality: specData.personality || "",
      scenario: specData.scenario || "",
      firstMessage: specData.firstMessage || specData.first_mes || "",
    };
  }

  async handleImportCard(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      let characterData = null;
      let importedImageUrl = "";

      if (
        file.type === "image/png" ||
        file.name.toLowerCase().endsWith(".png")
      ) {
        const extracted = await this.pngEncoder.extractCharacterData(file);
        characterData = this.normalizeCharacterFromSpec(extracted);
        importedImageUrl = URL.createObjectURL(file);
      } else {
        const text = await file.text();
        const parsed = JSON.parse(text);
        characterData = this.normalizeCharacterFromSpec(parsed);
      }

      if (!characterData) {
        throw new Error("Unable to parse card content");
      }

      this.currentCharacter = characterData;
      this.originalCharacter = JSON.parse(JSON.stringify(characterData));
      this.displayCharacter();
      this.showResultSection();

      if (importedImageUrl) {
        this.currentImageUrl = importedImageUrl;
        const imageContainer = document.getElementById("image-content");
        imageContainer.innerHTML = `
          <div class="image-container">
            <img src="${importedImageUrl}" alt="${characterData.name}" class="generated-image">
          </div>
        `;
      }

      document.getElementById("image-controls").style.display = "block";
      this.switchTab('editor');
      await this.saveCardToLibrary();
      await this.refreshLibraryViews();
      this.showNotification("Card imported for editing", "success");
    } catch (error) {
      console.error("Card import failed:", error);
      this.showNotification(`Card import failed: ${error.message}`, "error");
    } finally {
      event.target.value = "";
    }
  }

  async handleReviseCharacter() {
    if (!this.currentCharacter) {
      this.showNotification("Generate or import a character first", "warning");
      return;
    }

    const revisionInstruction = document
      .getElementById("revision-instruction")
      ?.value?.trim();
    if (!revisionInstruction) {
      this.showNotification("Enter a revision request first", "warning");
      return;
    }

    const reviseBtn = document.getElementById("revise-character-btn");
    const editorProgress = document.getElementById("editor-progress");
    try {
      const pov = document.getElementById("pov-select")?.value || "first";
      if (reviseBtn) {
        reviseBtn.disabled = true;
        reviseBtn.textContent = "Revising...";
      }
      if (editorProgress) editorProgress.style.display = "block";
      // Tell the AI which fields to skip
      let effectiveInstruction = revisionInstruction;
      if (this.lockedFields.size > 0) {
        const lockedNames = [...this.lockedFields].map((f) =>
          f === "firstMessage" ? "firstMessage" : f
        );
        effectiveInstruction += `\n\nIMPORTANT: Do NOT modify these locked fields — return them exactly as-is: ${lockedNames.join(", ")}`;
      }

      // Expand @mentions into referenced card context
      if (typeof expandMentions === "function") {
        effectiveInstruction = await expandMentions(effectiveInstruction, this.storage);
      }

      this.showNotification("Applying AI revision...", "info");
      const revised = await this.apiHandler.reviseCharacter(
        this.currentCharacter,
        effectiveInstruction,
        pov,
      );

      // Enforce locks — overwrite revised fields with originals for locked fields
      for (const lockedField of this.lockedFields) {
        if (this.currentCharacter[lockedField] != null) {
          revised[lockedField] = this.currentCharacter[lockedField];
        }
      }

      this.currentCharacter = revised;
      this.originalCharacter = JSON.parse(JSON.stringify(revised));
      this.displayCharacter();
      await this.saveCardToLibrary();
      await this.refreshLibraryViews();
      this.showNotification("Character revised successfully", "success");
      document.getElementById("revision-instruction").value = "";
    } catch (error) {
      console.error("Revision failed:", error);
      this.showNotification(`Revision failed: ${error.message}`, "error");
    } finally {
      if (reviseBtn) {
        reviseBtn.disabled = false;
        reviseBtn.textContent = "Revise Card with AI";
      }
      if (editorProgress) editorProgress.style.display = "none";
    }
  }

  async handleSaveCard() {
    if (!this.currentCharacter) {
      this.showNotification("No character to save", "warning");
      return;
    }
    this.syncFieldsFromEditor();
    await this.saveCardToLibrary();
    await this.refreshLibraryViews();
    this.showNotification("Card saved", "success");
  }

  async handleEvaluateCard() {
    if (!this.currentCharacter) {
      this.showNotification("Generate or import a character first", "warning");
      return;
    }

    const evaluateBtn = document.getElementById("evaluate-card-btn");
    const editorProgress = document.getElementById("editor-progress");
    try {
      if (evaluateBtn) {
        evaluateBtn.disabled = true;
        evaluateBtn.textContent = "Evaluating...";
      }
      if (editorProgress) editorProgress.style.display = "block";

      const evaluation = await this.apiHandler.evaluateCard(this.currentCharacter);
      this.lastEvaluation = evaluation;
      this.renderQualityResults(evaluation);

      // Persist quality score on the character for library display
      this.currentCharacter.qualityScore = evaluation.overallScore;
      await this.saveCardToLibrary();
      await this.refreshLibraryViews();

      const optimizeBtn = document.getElementById("optimize-card-btn");
      if (optimizeBtn) optimizeBtn.style.display = "";

      this.showNotification(`Quality score: ${evaluation.overallScore}/100`, "success");
    } catch (error) {
      console.error("Evaluation failed:", error);
      this.showNotification(`Evaluation failed: ${error.message}`, "error");
    } finally {
      if (evaluateBtn) {
        evaluateBtn.disabled = false;
        evaluateBtn.textContent = "Evaluate Card";
      }
      if (editorProgress) editorProgress.style.display = "none";
    }
  }

  renderQualityResults(evaluation) {
    const resultsEl = document.getElementById("quality-results");
    if (!resultsEl) return;
    resultsEl.style.display = "";

    // Score circle
    const scoreValue = document.getElementById("quality-score-value");
    const scoreCircle = document.getElementById("quality-score-circle");
    if (scoreValue) scoreValue.textContent = evaluation.overallScore;
    if (scoreCircle) {
      const score = evaluation.overallScore;
      const color = score >= 80 ? "var(--success)" : score >= 60 ? "var(--warning)" : "var(--error)";
      scoreCircle.style.borderColor = color;
      scoreCircle.querySelector(".quality-score-value").style.color = color;
    }

    // Dimension bars
    const dimensionsEl = document.getElementById("quality-dimensions");
    if (dimensionsEl) {
      const labels = {
        consistency: "Consistency",
        richness: "Richness",
        voice: "Voice",
        roleplayability: "Roleplayability",
        firstImpression: "First Impression",
        fieldPlacement: "Field Placement",
      };
      dimensionsEl.innerHTML = "";
      for (const [key, label] of Object.entries(labels)) {
        const dim = evaluation.dimensions?.[key];
        if (!dim) continue;
        const color = dim.score >= 80 ? "var(--success)" : dim.score >= 60 ? "var(--warning)" : "var(--error)";
        dimensionsEl.innerHTML += `
          <div class="quality-dimension">
            <div class="quality-dimension-header">
              <span class="quality-dimension-label">${label}</span>
              <span class="quality-dimension-score" style="color: ${color}">${dim.score}</span>
            </div>
            <div class="quality-bar-track"><div class="quality-bar-fill" style="width: ${dim.score}%; background: ${color}"></div></div>
            <p class="quality-dimension-comment">${dim.comment}</p>
          </div>`;
      }
    }

    // Contradictions
    const contradictionsSection = document.getElementById("quality-contradictions-section");
    const contradictionsList = document.getElementById("quality-contradictions-list");
    if (contradictionsSection && contradictionsList) {
      if (evaluation.contradictions?.length) {
        contradictionsSection.style.display = "";
        contradictionsList.innerHTML = evaluation.contradictions
          .map((c, i) => `<li data-index="${i}" data-type="contradiction"><strong>${c.fields?.join(" / ") || "General"}</strong>: ${c.issue}</li>`)
          .join("");
      } else {
        contradictionsSection.style.display = "none";
      }
    }

    // Suggestions
    const suggestionsSection = document.getElementById("quality-suggestions-section");
    const suggestionsList = document.getElementById("quality-suggestions-list");
    if (suggestionsSection && suggestionsList) {
      if (evaluation.suggestions?.length) {
        suggestionsSection.style.display = "";
        suggestionsList.innerHTML = evaluation.suggestions
          .map((s, i) => `<li data-index="${i}" data-type="suggestion">${s}</li>`)
          .join("");
      } else {
        suggestionsSection.style.display = "none";
      }
    }

    // Misplaced content
    const misplacedSection = document.getElementById("quality-misplaced-section");
    const misplacedList = document.getElementById("quality-misplaced-list");
    if (misplacedSection && misplacedList) {
      if (evaluation.misplacedContent?.length) {
        misplacedSection.style.display = "";
        misplacedList.innerHTML = evaluation.misplacedContent
          .map((m, i) => `<li data-index="${i}" data-type="misplaced"><strong>${m.currentField} → ${m.suggestedField}</strong>: "${m.excerpt}" — ${m.reason}</li>`)
          .join("");
      } else {
        misplacedSection.style.display = "none";
      }
    }

    // Click-to-toggle on list items
    const toggleExclude = (e) => {
      const li = e.target.closest("li[data-type]");
      if (li) li.classList.toggle("quality-excluded");
    };
    if (contradictionsList) contradictionsList.addEventListener("click", toggleExclude);
    if (suggestionsList) suggestionsList.addEventListener("click", toggleExclude);
    if (misplacedList) misplacedList.addEventListener("click", toggleExclude);

    // Show additional notes field
    const notesSection = document.getElementById("quality-optimize-notes-section");
    if (notesSection) notesSection.style.display = "";
  }

  async handleOptimizeCard() {
    if (!this.lastEvaluation || !this.currentCharacter) {
      this.showNotification("Run an evaluation first", "warning");
      return;
    }

    const optimizeBtn = document.getElementById("optimize-card-btn");
    const editorProgress = document.getElementById("editor-progress");
    try {
      if (optimizeBtn) {
        optimizeBtn.disabled = true;
        optimizeBtn.textContent = "Optimizing...";
      }
      if (editorProgress) editorProgress.style.display = "block";

      // Build revision instruction from evaluation findings, filtering out excluded items
      const getExcluded = (selector) => new Set(
        [...document.querySelectorAll(selector)].map((li) => li.dataset.index)
      );
      const excludedContradictions = getExcluded("#quality-contradictions-list li.quality-excluded");
      const excludedMisplaced = getExcluded("#quality-misplaced-list li.quality-excluded");
      const excludedSuggestions = getExcluded("#quality-suggestions-list li.quality-excluded");

      const parts = [];
      const activeContradictions = (this.lastEvaluation.contradictions || [])
        .filter((_, i) => !excludedContradictions.has(String(i)));
      const activeMisplaced = (this.lastEvaluation.misplacedContent || [])
        .filter((_, i) => !excludedMisplaced.has(String(i)));
      const activeSuggestions = (this.lastEvaluation.suggestions || [])
        .filter((_, i) => !excludedSuggestions.has(String(i)));

      if (activeContradictions.length) {
        parts.push("Fix these contradictions:\n" +
          activeContradictions.map((c) => `- ${c.fields?.join(" / ")}: ${c.issue}`).join("\n"));
      }
      if (activeMisplaced.length) {
        parts.push("Move misplaced content to the correct fields:\n" +
          activeMisplaced.map((m) => `- Move "${m.excerpt}" from ${m.currentField} to ${m.suggestedField} (${m.reason})`).join("\n"));
      }
      if (activeSuggestions.length) {
        parts.push("Apply these improvements:\n" +
          activeSuggestions.map((s) => `- ${s}`).join("\n"));
      }

      const additionalNotes = document.getElementById("quality-optimize-notes")?.value?.trim();
      if (additionalNotes) {
        parts.push("Additional notes from the author:\n" + additionalNotes);
      }

      if (!parts.length) {
        parts.push("Improve the overall quality, coherence, and roleplay-readiness of this character card.");
      }

      let instruction = parts.join("\n\n");

      // Respect locked fields
      if (this.lockedFields.size > 0) {
        const lockedNames = [...this.lockedFields];
        instruction += `\n\nIMPORTANT: Do NOT modify these locked fields — return them exactly as-is: ${lockedNames.join(", ")}`;
      }

      this.showNotification("Optimizing character card...", "info");
      const pov = document.getElementById("pov-select")?.value || "first";
      const revised = await this.apiHandler.reviseCharacter(this.currentCharacter, instruction, pov);

      // Enforce locks
      for (const lockedField of this.lockedFields) {
        if (this.currentCharacter[lockedField] != null) {
          revised[lockedField] = this.currentCharacter[lockedField];
        }
      }

      this.currentCharacter = revised;
      this.originalCharacter = JSON.parse(JSON.stringify(revised));
      this.displayCharacter();
      await this.saveCardToLibrary();
      await this.refreshLibraryViews();

      // Clear evaluation and switch to Character subtab
      this.lastEvaluation = null;
      document.getElementById("quality-results").style.display = "none";
      document.getElementById("optimize-card-btn").style.display = "none";
      const notesEl = document.getElementById("quality-optimize-notes");
      if (notesEl) notesEl.value = "";
      const notesSection = document.getElementById("quality-optimize-notes-section");
      if (notesSection) notesSection.style.display = "none";
      this.switchSubtab("char-image");
      this.showNotification("Card optimized! Review the changes, then re-evaluate if desired.", "success");
    } catch (error) {
      console.error("Optimization failed:", error);
      this.showNotification(`Optimization failed: ${error.message}`, "error");
    } finally {
      if (optimizeBtn) {
        optimizeBtn.disabled = false;
        optimizeBtn.textContent = "Optimize Card";
      }
      if (editorProgress) editorProgress.style.display = "none";
    }
  }

  async handleGenerateExampleMessages() {
    if (!this.currentCharacter) {
      this.showNotification("Generate or import a character first", "warning");
      return;
    }

    const count = parseInt(
      document.getElementById("example-messages-count")?.value || "3",
      10,
    );
    const generateBtn = document.getElementById("generate-examples-btn");
    const copyBtn = document.getElementById("copy-examples-btn");
    const outputDiv = document.getElementById("example-messages-output");

    const editorProgress = document.getElementById("editor-progress");
    try {
      generateBtn.disabled = true;
      generateBtn.textContent = "⏳ Generating...";
      if (editorProgress) editorProgress.style.display = "block";
      this.showNotification("Generating example messages...", "info");

      const pov = document.getElementById("pov-select")?.value || "first";
      const examples = await this.apiHandler.generateExampleMessages(
        this.currentCharacter,
        count,
        pov,
      );

      this.currentCharacter.mesExample = examples;
      outputDiv.textContent = examples;
      copyBtn.style.display = "inline-block";
      this.showNotification(`Generated ${count} example message(s)`, "success");
    } catch (error) {
      console.error("Example generation failed:", error);
      this.showNotification(`Generation failed: ${error.message}`, "error");
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = "✨ Generate";
      if (editorProgress) editorProgress.style.display = "none";
    }
  }

  async handleCopyExampleMessages() {
    const outputDiv = document.getElementById("example-messages-output");
    const text = outputDiv?.textContent;

    if (!text) {
      this.showNotification("No examples to copy", "warning");
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      this.showNotification("Copied to clipboard!", "success");
    } catch (error) {
      console.error("Copy failed:", error);
      this.showNotification("Failed to copy to clipboard", "error");
    }
  }

  async savePromptToLibrary(promptData) {
    if (!this.storageReady || !this.storage) return false;
    try {
      const normalized = this.preparePromptRecordForStorage(promptData);
      const fingerprint = [
        normalized.concept || "",
        normalized.characterName || "",
        normalized.pov || "",
        normalized.referenceImageDescription || "",
      ].join("::");

      const existingPrompts = await this.storage.listPrompts();
      const existing = existingPrompts.find(
        (entry) => entry.fingerprint === fingerprint,
      );

      const { _trimmedFields, ...promptRecord } = normalized;
      const fullRecord = {
        ...promptRecord,
        fingerprint,
      };
      if (Number.isInteger(existing?.id) && existing.id > 0) {
        fullRecord.id = existing.id;
      }
      await this.storage.savePrompt(fullRecord);

      if (_trimmedFields?.length) {
        this.showNotification(
          `Prompt saved. Omitted large ${_trimmedFields.join(" and ")} snapshot for storage safety.`,
          "warning",
        );
      }
      return true;
    } catch (error) {
      console.error("Failed to save prompt (full record):", error);

      // Retry with minimal payload so prompts still persist even if optional
      // lorebook/reference snapshots exceed storage limits.
      try {
        const minimal = this.preparePromptRecordForStorage(promptData, {
          minimal: true,
        });
        const fingerprint = [
          minimal.concept || "",
          minimal.characterName || "",
          minimal.pov || "",
          minimal.referenceImageDescription || "",
        ].join("::");

        const existingPrompts = await this.storage.listPrompts();
        const existing = existingPrompts.find(
          (entry) => entry.fingerprint === fingerprint,
        );

        const { _trimmedFields, ...minimalRecord } = minimal;
        const retryRecord = {
          ...minimalRecord,
          fingerprint,
        };
        if (Number.isInteger(existing?.id) && existing.id > 0) {
          retryRecord.id = existing.id;
        }
        await this.storage.savePrompt(retryRecord);

        this.showNotification(
          "Prompt saved in compact mode (large context omitted).",
          "warning",
        );
        return true;
      } catch (retryError) {
        console.error("Failed to save prompt (compact retry):", retryError);
        this.updateLibraryStatus(
          "Failed to save prompt. Check browser storage permissions.",
        );
        return false;
      }
    }
  }

  preparePromptRecordForStorage(promptData, options = {}) {
    const minimal = Boolean(options.minimal);
    const maxEmbeddedChars = 400000;

    const safe = {
      concept: promptData?.concept || "",
      characterName: promptData?.characterName || "",
      pov: promptData?.pov || "first",
      referenceImageDescription: promptData?.referenceImageDescription || "",
      referenceImageDataUrl: "",
      lorebookData: null,
      _trimmedFields: [],
    };

    if (minimal) {
      return safe;
    }

    const referenceImageDataUrl = promptData?.referenceImageDataUrl || "";
    if (referenceImageDataUrl) {
      if (referenceImageDataUrl.length <= maxEmbeddedChars) {
        safe.referenceImageDataUrl = referenceImageDataUrl;
      } else {
        safe._trimmedFields.push("reference-image");
      }
    }

    if (promptData?.lorebookData) {
      try {
        const lorebookJson = JSON.stringify(promptData.lorebookData);
        if (lorebookJson.length <= maxEmbeddedChars) {
          safe.lorebookData = JSON.parse(lorebookJson);
        } else {
          safe._trimmedFields.push("lorebook");
        }
      } catch (error) {
        safe._trimmedFields.push("lorebook");
      }
    }

    return safe;
  }

  async saveCardToLibrary(steeringInput = null) {
    if (!this.storageReady || !this.storage || !this.currentCharacter) return;

    const name = this.currentCharacter.name || "Unnamed Character";
    const slug = this.slugifyName(name);

    // If this is a different card than what's currently loaded, check for conflicts
    if (slug !== this.currentCardSlug) {
      try {
        const cards = await this.storage.listCards();
        const existing = cards.find((c) => c.id === slug);
        if (existing) {
          const existingDate = existing.updatedAt
            ? new Date(existing.updatedAt).toLocaleDateString()
            : "unknown date";
          if (!confirm(
            `A card named "${existing.characterName}" (saved ${existingDate}) already exists in your library.\n\nOverwrite it with the new "${name}"?`
          )) {
            return;
          }
        }
      } catch {
        // If check fails, proceed with save
      }
    }

    try {
      let imageBlob = null;
      if (this.currentImageUrl) {
        try {
          imageBlob = await this.imageGenerator.convertToBlob(
            this.currentImageUrl,
          );
        } catch (error) {
          console.warn("Skipping image blob save:", error.message);
        }
      }

      await this.storage.saveCard({
        characterName: name,
        character: JSON.parse(JSON.stringify(this.currentCharacter)),
        imageBlob,
        steeringInput,
      });
      this.currentCardSlug = slug;
      // Invalidate @mention autocomplete cache so new/updated cards appear
      if (this.mentionConcept) this.mentionConcept.invalidateCache();
      if (this.mentionRevision) this.mentionRevision.invalidateCache();
    } catch (error) {
      console.error("Failed to save card:", error);
    }
  }

  formatLibraryTime(isoString) {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return "Unknown time";
    return date.toLocaleString();
  }

  formatLibraryDate(isoString) {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return "?";
    const now = new Date();
    const diff = now - date;
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  async refreshLibraryViews() {
    if (!this.storageReady || !this.storage) {
      this.renderStorageUnavailableState();
      return;
    }

    try {
      const cards = await this.storage.listCards();
      const cardList = document.getElementById("stored-cards-list");

      if (cardList) {
        if (!cards.length) {
          cardList.innerHTML =
            '<p class="library-empty">No saved cards yet.</p>';
        } else {
          cardList.innerHTML = cards
            .map(
              (card) => {
                const scoreBadge = card.qualityScore != null
                  ? `<span class="library-item-score ${card.qualityScore >= 80 ? "score-good" : card.qualityScore >= 60 ? "score-ok" : "score-low"}">${card.qualityScore}</span>`
                  : "";
                const dateParts = [];
                dateParts.push(this.formatLibraryDate(card.updatedAt));
                if (card.commitCount) dateParts.push(`${card.commitCount}v`);
                return `
                <div class="library-item" data-card-name="${(card.characterName || "").toLowerCase()}">
                  <div class="library-item-header">
                    <div class="library-item-title">${card.characterName || "Unnamed Character"}</div>
                    <div class="library-item-meta">${scoreBadge}<span class="library-item-date">${dateParts.join(" · ")}</span></div>
                  </div>
                  <div class="library-item-actions">
                    <button class="btn-small" data-action="load-card" data-id="${card.id}">Load</button>
                    ${card.commitCount > 0 ? `<button class="btn-small" data-action="view-history" data-id="${card.id}" data-name="${card.characterName || "Card"}">History</button>` : ""}
                    <button class="btn-small" data-action="delete-card" data-id="${card.id}">Delete</button>
                  </div>
                </div>
              `;
              },
            )
            .join("");
        }
      }

      this.updateLibraryStatus(
        `${cards.length} saved card${cards.length === 1 ? "" : "s"}.`,
      );
    } catch (error) {
      console.error("Failed to refresh IndexedDB library view:", error);
      this.updateLibraryStatus("Failed to load local library.");
    }
  }

  renderStorageUnavailableState() {
    const cardList = document.getElementById("stored-cards-list");
    const message =
      '<p class="library-empty">Local storage is unavailable in this browser/session.</p>';
    if (cardList) {
      cardList.innerHTML = message;
    }
  }

  updateLibraryStatus(text) {
    const status = document.getElementById("library-status");
    if (status) {
      status.textContent = text;
    }
  }

  async handleLibraryPromptClick(event) {
    const actionElement = event.target.closest("[data-action]");
    if (!actionElement) return;

    const action = actionElement.dataset.action;
    // Prompt IDs may be slugs (strings) with server storage or numeric with IndexedDB
    const rawId = actionElement.dataset.id;
    const id = /^\d+$/.test(rawId) ? Number(rawId) : rawId;

    try {
      if (action === "load-prompt") {
        const prompt = await this.storage.getPrompt(id);
        if (!prompt) return;
        document.getElementById("character-concept").value =
          prompt.concept || "";
        document.getElementById("character-name").value =
          prompt.characterName || "";
        document.getElementById("pov-select").value = prompt.pov || "first";
        const refDescription = document.getElementById(
          "reference-image-description",
        );
        if (refDescription) {
          refDescription.value = prompt.referenceImageDescription || "";
        }
        if (prompt.referenceImageDataUrl) {
          this.referenceImageDataUrl = prompt.referenceImageDataUrl;
          this.updateReferenceImagePreview(prompt.referenceImageDataUrl);
        }
        this.lorebookData = prompt.lorebookData || null;
        this.showNotification("Prompt loaded", "success");
      } else if (action === "delete-prompt") {
        await this.storage.deletePrompt(id);
        await this.refreshLibraryViews();
        this.showNotification("Prompt deleted", "info");
      }
    } catch (error) {
      console.error("Prompt library action failed:", error);
      this.showNotification("Prompt action failed", "error");
    }
  }

  async handleLibraryCardClick(event) {
    const actionElement = event.target.closest("[data-action]");
    if (!actionElement) return;

    const action = actionElement.dataset.action;
    // Card IDs may be slugs (strings) with server storage or numeric with IndexedDB
    const rawId = actionElement.dataset.id;
    const id = /^\d+$/.test(rawId) ? Number(rawId) : rawId;

    try {
      if (action === "load-card") {
        const card = await this.storage.getCard(id);
        if (!card?.character) return;
        this.currentCardSlug = id;
        this.currentCharacter = card.character;
        this.originalCharacter = JSON.parse(JSON.stringify(card.character));
        this.displayCharacter();
        this.showResultSection();
        document.getElementById("image-controls").style.display = "block";

        if (card.imageBlob instanceof Blob) {
          if (
            this.currentImageUrl &&
            this.currentImageUrl.startsWith("blob:")
          ) {
            URL.revokeObjectURL(this.currentImageUrl);
          }
          this.currentImageUrl = URL.createObjectURL(card.imageBlob);
          const imageContainer = document.getElementById("image-content");
          imageContainer.innerHTML = `
            <div class="image-container">
              <img src="${this.currentImageUrl}" alt="${card.character.name || "Character"}" class="generated-image">
            </div>
          `;
        } else if (card.avatarUrl) {
          this.currentImageUrl = card.avatarUrl;
          const imageContainer = document.getElementById("image-content");
          imageContainer.innerHTML = `
            <div class="image-container">
              <img src="${card.avatarUrl}" alt="${card.character.name || "Character"}" class="generated-image">
            </div>
          `;
        }
        this.closeLibraryDrawer();
        this.switchTab('editor');
        this.showNotification("Card loaded", "success");
      } else if (action === "view-history") {
        const name = actionElement.dataset.name || id;
        this.openHistoryModal(String(id), name);
      } else if (action === "delete-card") {
        await this.storage.deleteCard(id);
        await this.refreshLibraryViews();
        this.showNotification("Card deleted", "info");
      }
    } catch (error) {
      console.error("Card library action failed:", error);
      this.showNotification("Card action failed", "error");
    }
  }

  showNotification(message, type = "info") {
    // Dismiss any existing notification immediately
    if (this._currentNotification && this._currentNotification.parentNode) {
      this._currentNotification.parentNode.removeChild(this._currentNotification);
    }
    clearTimeout(this._notificationFadeTimer);
    clearTimeout(this._notificationRemoveTimer);

    const notification = document.createElement("div");
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            transform: translateX(100%);
            transition: transform 0.3s ease;
            max-width: 400px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        `;

    const colors = {
      success: "#28a745",
      error: "#dc3545",
      warning: "#ffc107",
      info: "#0066cc",
    };

    notification.style.backgroundColor = colors[type] || colors.info;
    notification.textContent = message;

    document.body.appendChild(notification);
    this._currentNotification = notification;

    // Animate in
    setTimeout(() => {
      notification.style.transform = "translateX(0)";
    }, 10);

    // Remove after 5 seconds
    this._notificationFadeTimer = setTimeout(() => {
      notification.style.transform = "translateX(100%)";
      this._notificationRemoveTimer = setTimeout(() => {
        if (notification.parentNode) {
          document.body.removeChild(notification);
        }
        if (this._currentNotification === notification) {
          this._currentNotification = null;
        }
      }, 300);
    }, 5000);
  }

  // ── Version History Modal ──────────────────────────────────────────────────

  async openHistoryModal(slug, name) {
    const modal = document.getElementById("history-modal");
    const titleEl = document.getElementById("history-modal-title");
    const listEl = document.getElementById("history-list");
    const previewEl = document.getElementById("history-preview");

    if (!modal) return;

    titleEl.textContent = `Version History — ${name}`;
    listEl.innerHTML = '<p class="library-empty">Loading history…</p>';
    if (previewEl) previewEl.style.display = "none";

    modal.classList.add("show");
    document.body.style.overflow = "hidden";

    // Store slug for restore
    modal.dataset.slug = slug;

    try {
      const res = await fetch(`/api/cards/${slug}/history`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const history = await res.json();

      if (!history.length) {
        listEl.innerHTML = '<p class="library-empty">No history yet.</p>';
        return;
      }

      listEl.innerHTML = history
        .map(
          (entry, i) => `
          <div class="history-entry" data-hash="${entry.hash}" data-slug="${slug}">
            <span class="history-entry-time">${this.formatLibraryTime(entry.timestamp)}${i === 0 ? " (current)" : ""}</span>
            ${entry.steeringInput ? `<span class="history-entry-steering">${this.escapeHtml(entry.steeringInput)}</span>` : ""}
          </div>
        `,
        )
        .join("");

      // Click a version entry to preview it
      listEl.addEventListener("click", (e) => {
        const entry = e.target.closest(".history-entry");
        if (!entry) return;
        listEl
          .querySelectorAll(".history-entry")
          .forEach((el) => el.classList.remove("active"));
        entry.classList.add("active");
        this.loadHistoryVersion(entry.dataset.slug, entry.dataset.hash);
      });
    } catch (err) {
      listEl.innerHTML = `<p class="library-empty">Failed to load history: ${err.message}</p>`;
    }
  }

  async loadHistoryVersion(slug, hash) {
    const previewEl = document.getElementById("history-preview");
    const labelEl = document.getElementById("history-preview-label");
    const fieldsEl = document.getElementById("history-preview-fields");
    const restoreBtn = document.getElementById("history-restore-btn");

    if (!previewEl) return;
    previewEl.style.display = "block";
    labelEl.textContent = "Loading…";
    fieldsEl.innerHTML = "";

    try {
      const res = await fetch(`/api/cards/${slug}/version/${hash}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { card } = await res.json();

      labelEl.textContent = `Snapshot — ${card.name || slug}`;

      const fields = ["description", "personality", "scenario", "firstMessage"];
      fieldsEl.innerHTML = fields
        .filter((f) => card[f])
        .map(
          (f) => `
          <div class="history-field">
            <span class="history-field-name">${f === "firstMessage" ? "First Message" : f}</span>
            <div class="history-field-value">${this.escapeHtml(card[f] || "")}</div>
          </div>
        `,
        )
        .join("");

      // Wire restore button
      restoreBtn.onclick = () => {
        this.currentCharacter = card;
        this.originalCharacter = JSON.parse(JSON.stringify(card));
        this.displayCharacter();
        this.showResultSection();
        document.getElementById("history-modal").classList.remove("show");
        document.body.style.overflow = "";
        this.switchTab('editor');
        this.showNotification("Version restored", "success");
      };
    } catch (err) {
      labelEl.textContent = `Error: ${err.message}`;
    }
  }

  closeHistoryModal() {
    const modal = document.getElementById("history-modal");
    if (modal) modal.classList.remove("show");
    document.body.style.overflow = "";
  }

  // ── Field lock ─────────────────────────────────────────────────────────────

  toggleFieldLock(field, btn) {
    const isLocked = this.lockedFields.has(field);
    if (isLocked) {
      this.lockedFields.delete(field);
      btn.classList.remove("locked");
      btn.textContent = "🔓";
      btn.title = "Lock field from AI revision";
    } else {
      this.lockedFields.add(field);
      btn.classList.add("locked");
      btn.textContent = "🔒";
      btn.title = "Unlock field for AI revision";
    }
    // Visual indicator on the field container
    const fieldEl = btn.closest(".character-field");
    if (fieldEl) fieldEl.classList.toggle("field-locked", !isLocked);
  }

  // ── Diff rendering (powered by jsdiff) ──────────────────────────────────────

  /**
   * Render an inline diff between two texts.
   * @param {string} oldText - The older/selected version
   * @param {string} newText - The current/editor version
   * @param {'words'|'sentences'|'lines'} mode - Diff granularity
   * @returns {string} HTML with inline diff markup
   */
  renderDiffHtml(oldText, newText, mode = "words") {
    const opts = { timeout: 500 };
    const diffFn = {
      words: Diff.diffWordsWithSpace,
      sentences: Diff.diffSentences,
      lines: Diff.diffLines,
    }[mode] || Diff.diffSentences;

    const parts = diffFn(oldText, newText, opts);
    if (!parts) {
      return `<span class="diff-removed">${this.escapeHtml(oldText)}</span><span class="diff-added">${this.escapeHtml(newText)}</span>`;
    }
    return parts.map((part) => {
      const escaped = this.escapeHtml(part.value);
      if (part.removed) return `<span class="diff-removed">${escaped}</span>`;
      if (part.added) return `<span class="diff-added">${escaped}</span>`;
      return escaped;
    }).join("");
  }

  // ── Per-Field History Modal ─────────────────────────────────────────────────

  async openFieldHistory(field) {
    if (!this.currentCharacter?.name) {
      this.showNotification("No character loaded", "warning");
      return;
    }

    const fieldLabels = {
      description: "Description",
      personality: "Personality",
      scenario: "Scenario",
      firstMessage: "First Message",
    };

    const slug = this.slugifyName(this.currentCharacter.name);
    const modal = document.getElementById("field-history-modal");
    const titleEl = document.getElementById("field-history-title");
    const versionsEl = document.getElementById("field-history-versions");
    const diffEl = document.getElementById("field-history-diff");
    const actionsEl = document.getElementById("field-history-actions");

    titleEl.textContent = `${fieldLabels[field] || field} — History`;
    versionsEl.innerHTML = '<p class="library-empty">Loading...</p>';
    diffEl.innerHTML = '<p style="color: var(--text-soft); font-style: italic;">Select a version to compare</p>';
    actionsEl.style.display = "none";

    modal.classList.add("show");
    document.body.style.overflow = "hidden";

    try {
      const res = await fetch(`/api/cards/${slug}/history`);
      if (!res.ok) throw new Error("Failed to load history");
      const history = await res.json();

      if (!history.length) {
        versionsEl.innerHTML = '<p class="library-empty">No version history yet</p>';
        return;
      }

      // Fetch all versions to get field values
      const versions = await Promise.all(
        history.map(async (entry) => {
          try {
            const vRes = await fetch(`/api/cards/${slug}/version/${entry.hash}`);
            if (!vRes.ok) return null;
            const data = await vRes.json();
            return {
              hash: entry.hash,
              timestamp: entry.timestamp,
              steeringInput: entry.steeringInput,
              card: data.card,
            };
          } catch {
            return null;
          }
        })
      );

      const validVersions = versions.filter(Boolean);
      if (!validVersions.length) {
        versionsEl.innerHTML = '<p class="library-empty">No versions available</p>';
        return;
      }

      // Get current editor value for comparison
      const textareaMap = {
        description: "character-description",
        personality: "character-personality",
        scenario: "character-scenario",
        firstMessage: "character-first-message",
      };
      // Map internal field names to possible stored key names
      const altKeys = {
        firstMessage: ["firstMessage", "first_mes"],
        mesExample: ["mesExample", "mes_example"],
      };

      const getFieldValue = (card) => {
        if (card[field] != null && card[field] !== "") return card[field];
        const alts = altKeys[field];
        if (alts) {
          for (const key of alts) {
            if (card[key] != null && card[key] !== "") return card[key];
          }
        }
        return "";
      };

      const currentValue = document.getElementById(textareaMap[field])?.value || "";

      // View state
      let activeViewMode = "view"; // "view" or "diff"
      let activeDiffGranularity = "sentences";
      let activeSelectedValue = null;

      const granularityEl = document.getElementById("field-history-diff-granularity");

      const renderContent = () => {
        if (activeSelectedValue === null) return;
        const isSame = currentValue.trim() === activeSelectedValue.trim();

        if (activeViewMode === "view") {
          granularityEl.style.display = "none";
          diffEl.innerHTML = `
            <div class="field-history-diff-panel">
              <div class="diff-text">${this.escapeHtml(activeSelectedValue || "(empty)")}</div>
            </div>
          `;
        } else {
          granularityEl.style.display = "flex";
          if (isSame) {
            diffEl.innerHTML = `
              <div class="field-history-diff-panel">
                <p style="font-size: 0.82rem; color: var(--text-soft); font-style: italic; margin-bottom: 0.5rem;">No differences from current editor</p>
                <div class="diff-text">${this.escapeHtml(currentValue || "(empty)")}</div>
              </div>
            `;
          } else {
            diffEl.innerHTML = `
              <div class="field-history-diff-panel">
                <div class="diff-legend">
                  <span class="diff-legend-item"><span class="diff-removed">removed</span> from selected</span>
                  <span class="diff-legend-item"><span class="diff-added">added</span> in current</span>
                </div>
                <div class="diff-text diff-inline">${this.renderDiffHtml(activeSelectedValue, currentValue, activeDiffGranularity)}</div>
              </div>
            `;
          }
        }

        // Show revert button if versions differ (in either mode)
        if (!isSame) {
          actionsEl.style.display = "flex";
          document.getElementById("field-history-revert-btn").onclick = () => {
            const textarea = document.getElementById(textareaMap[field]);
            if (textarea) {
              textarea.value = activeSelectedValue;
              this.currentCharacter[field] = activeSelectedValue;
            }
            modal.classList.remove("show");
            document.body.style.overflow = "";
            this.showNotification(`${fieldLabels[field]} reverted to selected version`, "success");
          };
        } else {
          actionsEl.style.display = "none";
        }
      };

      // Wire up view/diff toggle
      modal.querySelectorAll("#field-history-view-toggle .diff-mode-btn").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.view === activeViewMode);
        btn.onclick = () => {
          activeViewMode = btn.dataset.view;
          modal.querySelectorAll("#field-history-view-toggle .diff-mode-btn").forEach((b) => b.classList.toggle("active", b === btn));
          renderContent();
        };
      });

      // Wire up diff granularity toggle
      granularityEl.querySelectorAll(".diff-mode-btn").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.mode === activeDiffGranularity);
        btn.onclick = () => {
          activeDiffGranularity = btn.dataset.mode;
          granularityEl.querySelectorAll(".diff-mode-btn").forEach((b) => b.classList.toggle("active", b === btn));
          renderContent();
        };
      });

      // Render version list
      versionsEl.innerHTML = "";
      validVersions.forEach((v, i) => {
        const btn = document.createElement("button");
        btn.className = "field-history-version-btn";
        const date = new Date(v.timestamp);
        const dateStr = date.toLocaleDateString();
        const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const label = i === 0 ? "Latest saved" : v.steeringInput ? v.steeringInput.slice(0, 30) : `Version ${validVersions.length - i}`;
        btn.innerHTML = `<span class="version-label">${this.escapeHtml(label)}</span><span class="version-date">${dateStr} ${timeStr}</span>`;

        btn.addEventListener("click", () => {
          versionsEl.querySelectorAll(".field-history-version-btn").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          activeSelectedValue = getFieldValue(v.card);
          renderContent();
        });

        versionsEl.appendChild(btn);
      });
    } catch (err) {
      versionsEl.innerHTML = `<p class="library-empty">Error: ${err.message}</p>`;
    }
  }

  // ── Regeneration Diff Modal ────────────────────────────────────────────────

  showDiffModal(prevValues) {
    if (!prevValues || !this.currentCharacter) return;

    const fields = [
      { key: "description", label: "Description" },
      { key: "personality", label: "Personality" },
      { key: "scenario", label: "Scenario" },
      { key: "firstMessage", label: "First Message" },
    ];

    const changed = fields.filter((f) => {
      const prev = (prevValues[f.key] || "").trim();
      const next = (this.currentCharacter[f.key] || "").trim();
      return prev && next && prev !== next;
    });

    if (!changed.length) {
      this.showNotification("No field content changed.", "info");
      return;
    }

    const contentEl = document.getElementById("diff-modal-content");
    if (contentEl) {
      contentEl.innerHTML = changed
        .map(
          (f) => `
          <div class="diff-field">
            <div class="diff-field-header">${f.label}</div>
            <div class="diff-before">
              <span class="diff-label">Before</span>
              <div class="diff-value">${this.escapeHtml(prevValues[f.key] || "")}</div>
            </div>
            <div class="diff-after">
              <span class="diff-label">After</span>
              <div class="diff-value">${this.escapeHtml(this.currentCharacter[f.key] || "")}</div>
            </div>
          </div>
        `,
        )
        .join("");
    }

    const modal = document.getElementById("diff-modal");
    if (modal) {
      modal.classList.add("show");
      document.body.style.overflow = "hidden";
    }
  }

  closeDiffModal() {
    const modal = document.getElementById("diff-modal");
    if (modal) modal.classList.remove("show");
    document.body.style.overflow = "";
  }

  _showChangesLink(prevValues) {
    this._removeChangesLink();
    // Only show if there are actual changes
    const fields = ["description", "personality", "scenario", "firstMessage"];
    const hasChanges = fields.some((f) => {
      const prev = (prevValues[f] || "").trim();
      const next = (this.currentCharacter?.[f] || "").trim();
      return prev && next && prev !== next;
    });
    if (!hasChanges) return;

    const splitLeft = document.querySelector(".split-left");
    if (!splitLeft) return;

    const btn = document.createElement("button");
    btn.id = "show-changes-link";
    btn.className = "show-changes-link";
    btn.textContent = "⟷ Show what changed";
    btn.addEventListener("click", () => this.showDiffModal(prevValues));
    splitLeft.insertBefore(btn, splitLeft.firstChild);
  }

  _removeChangesLink() {
    document.getElementById("show-changes-link")?.remove();
  }

  // Utility methods
  validateInput() {
    const concept = document.getElementById("character-concept").value.trim();
    const characterName = document
      .getElementById("character-name")
      .value.trim();

    const errors = [];

    if (!concept) {
      errors.push("Character concept is required");
    } else if (concept.length < 10) {
      errors.push("Character concept should be at least 10 characters");
    } else if (concept.length > 1000) {
      errors.push("Character concept should be less than 1000 characters");
    }

    if (characterName && characterName.length > 50) {
      errors.push("Character name should be less than 50 characters");
    }

    return errors;
  }

  // Keyboard shortcuts
  setupKeyboardShortcuts() {
    document.addEventListener("keydown", (e) => {
      // Ctrl/Cmd + Enter to generate
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        if (!this.isGenerating) {
          this.handleGenerate();
        }
      }

      // Escape to cancel/clear
      if (e.key === "Escape") {
        if (this.isGenerating) {
          // Cancel generation (would need implementation in API calls)
          this.showNotification(
            "Cannot cancel generation in progress",
            "warning",
          );
        } else {
          this.handleRegenerate();
        }
      }
    });
  }
  handleLorebookUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result);
        this.lorebookData = json;

        // Update UI to show loaded status
        const statusIcon = document.getElementById("lorebook-status");
        statusIcon.style.display = "block";
        this.showNotification("Lorebook loaded successfully!", "success");
        console.log("Lorebook loaded:", this.lorebookData);
      } catch (error) {
        console.error("Error parsing lorebook:", error);
        this.showNotification("Failed to parse Lorebook JSON", "error");
        this.lorebookData = null;
        document.getElementById("lorebook-status").style.display = "none";
      }
    };
    reader.readAsText(file);
  }
}

// Update prompt character counter
window.updatePromptCharCount = function () {
  const textarea = document.getElementById("custom-image-prompt");
  const counter = document.getElementById("prompt-char-count");

  if (textarea && counter) {
    const length = textarea.value.length;
    counter.textContent = `${length}/1000`;

    // Change color based on character count
    if (length >= 950) {
      counter.style.color = "#ef4444"; // Red
      counter.style.color = "#f59e0b"; // Orange
    } else {
      counter.style.color = "#9ca3af"; // Gray
    }
  }
};

// Wait for DOM to be loaded
document.addEventListener("DOMContentLoaded", async () => {
  // Wait a moment to ensure all modules are loaded
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Verify all required modules are loaded
  if (
    !window.config ||
    !window.apiHandler ||
    !window.characterGenerator ||
    !window.imageGenerator ||
    !window.pngEncoder
  ) {
    console.error("Missing modules:", {
      config: !!window.config,
      apiHandler: !!window.apiHandler,
      characterGenerator: !!window.characterGenerator,
      imageGenerator: !!window.imageGenerator,
      pngEncoder: !!window.pngEncoder,
    });
    return;
  }

  // Initialize app
  window.app = new CharacterGeneratorApp();

  // Add some CSS for tags
  const style = document.createElement("style");
  style.textContent = `
        .tags {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
            margin-top: 0.5rem;
        }

        .tag {
            background: var(--bg-tertiary);
            color: var(--text-secondary);
            padding: 0.25rem 0.75rem;
            border-radius: 20px;
            font-size: 0.875rem;
            font-weight: 500;
        }

        .character-section {
            margin-bottom: 1.5rem;
        }

        .character-section strong {
            color: var(--text-primary);
            display: block;
            margin-bottom: 0.5rem;
        }

        .image-container {
            text-align: center;
        }

        .generated-image {
            max-width: 100%;
            height: auto;
            border-radius: var(--radius);
            box-shadow: var(--shadow-sm);
        }

        .form-section {
            background: var(--bg-tertiary);
            padding: 1rem;
            border-radius: calc(var(--radius) / 2);
            margin-bottom: 1rem;
        }

        .form-section-title {
            font-weight: 600;
            margin-bottom: 1rem;
            color: var(--text-primary);
        }
    `;
  document.head.appendChild(style);

  // Console welcome message
  console.log(
    "%c🎭 SillyTavern Character Generator",
    "font-size: 20px; font-weight: bold; color: #0066cc;",
  );
  console.log(
    "%cCreate amazing characters with AI!",
    "font-size: 14px; color: #666;",
  );
  console.log(
    "%cTip: Press Ctrl+Enter to generate a character",
    "font-size: 12px; color: #999;",
  );
});
