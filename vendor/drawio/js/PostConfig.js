/**
 * Copyright (c) 2006-2024, JGraph Holdings Ltd
 * Copyright (c) 2006-2024, draw.io AG
 */
// null'ing of global vars need to be after init.js
window.ICONSEARCH_PATH = null;

// Add pseudo-docking and boundaries for mermaid-tool integration
(function initMermaidOverrides() {
    if (typeof mxWindow !== 'undefined' && mxWindow.prototype && mxWindow.prototype.setLocation) {
        var oldSetLoc = mxWindow.prototype.setLocation;
        var oldSetSize = mxWindow.prototype.setSize;
        var oldShow = mxWindow.prototype.show;
        var oldHide = mxWindow.prototype.hide;
        var oldDestroy = mxWindow.prototype.destroy;
        var oldSetTitle = mxWindow.prototype.setTitle;
        var dockedRailWidth = 7;
        var dockedToolbarTop = 44;
        var collapsedRailInset = 12;

        function setWindowWidth(windowInstance, width) {
            var cssWidth = width + 'px';
            windowInstance.div.style.width = cssWidth;

            if (windowInstance.table != null) {
                windowInstance.table.style.width = cssWidth;
            }
        }

        function normalizeText(value) {
            return String(value || '').replace(/\s+/g, ' ').trim();
        }

        function getManagedPanelRole(windowInstance) {
            if (windowInstance == null) {
                return null;
            }

            if (windowInstance._mermaidPanelRole === 'shapes' || windowInstance._mermaidPanelRole === 'format') {
                return windowInstance._mermaidPanelRole;
            }

            var titleText = normalizeText(windowInstance.title != null ? windowInstance.title.textContent : '');
            var shapesTitle = typeof mxResources !== 'undefined' ? normalizeText(mxResources.get('shapes')) : 'Shapes';
            var formatTitle = typeof mxResources !== 'undefined' ? normalizeText(mxResources.get('format')) : 'Format';

            if (titleText === shapesTitle) {
                windowInstance._mermaidPanelRole = 'shapes';
            } else if (titleText === formatTitle) {
                windowInstance._mermaidPanelRole = 'format';
            }

            return windowInstance._mermaidPanelRole || null;
        }

        function getDockTarget(windowInstance) {
            if (windowInstance.div.classList.contains('mermaid-docked-left')) {
                return 'left';
            }

            if (windowInstance.div.classList.contains('mermaid-docked-right')) {
                return 'right';
            }

            return null;
        }

        function hideToggleRail(windowInstance) {
            if (windowInstance.div != null && windowInstance.div._mermaidToggleRail != null) {
                windowInstance.div._mermaidToggleRail.style.display = 'none';
            }
        }

        function updateEditorUiLayout(editorUi) {
            if (editorUi == null || editorUi.diagramContainer == null) {
                return;
            }

            var reserveLeft = 0;
            var reserveRight = 0;
            var shapesWindow = editorUi.sidebarWindow != null ? editorUi.sidebarWindow.window : null;
            var formatWindow = editorUi.formatWindow != null ? editorUi.formatWindow.window : null;

            if (
                shapesWindow != null &&
                shapesWindow.div != null &&
                getManagedPanelRole(shapesWindow) === 'shapes' &&
                getDockTarget(shapesWindow) === 'left' &&
                shapesWindow.isVisible()
            ) {
                reserveLeft = (shapesWindow.div.offsetWidth || shapesWindow.div._mermaidExpandedWidth || 212) + dockedRailWidth;
            }

            if (
                formatWindow != null &&
                formatWindow.div != null &&
                getManagedPanelRole(formatWindow) === 'format' &&
                getDockTarget(formatWindow) === 'right'
            ) {
                reserveRight = formatWindow.isVisible()
                    ? (formatWindow.div.offsetWidth || formatWindow.div._mermaidExpandedWidth || 240) + dockedRailWidth
                    : collapsedRailInset + dockedRailWidth;
            }

            var nextMarginLeft = reserveLeft > 0 ? reserveLeft + 'px' : '';
            var nextMarginRight = reserveRight > 0 ? reserveRight + 'px' : '';
            var didChange = false;

            if (editorUi.diagramContainer.style.marginLeft !== nextMarginLeft) {
                editorUi.diagramContainer.style.marginLeft = nextMarginLeft;
                didChange = true;
            }

            if (editorUi.diagramContainer.style.marginRight !== nextMarginRight) {
                editorUi.diagramContainer.style.marginRight = nextMarginRight;
                didChange = true;
            }

            if (didChange) {
                if (editorUi.editor != null && editorUi.editor.graph != null) {
                    editorUi.editor.graph.sizeDidChange();
                }
            }
        }

        function updateToggleRail(windowInstance, dockTarget) {
            if (
                windowInstance.div == null ||
                windowInstance.div._mermaidToggleRail == null ||
                getManagedPanelRole(windowInstance) == null
            ) {
                return;
            }

            var rail = windowInstance.div._mermaidToggleRail;
            var isVisible = windowInstance.isVisible();

            if (dockTarget == null) {
                rail.style.display = 'none';
                return;
            }

            rail.style.display = 'block';
            rail.dataset.role = getManagedPanelRole(windowInstance);
            rail.dataset.side = dockTarget;
            rail.style.top = dockedToolbarTop + 'px';
            rail.style.height = Math.max(0, window.innerHeight - dockedToolbarTop) + 'px';

            if (isVisible) {
                rail.style.left = (
                    dockTarget === 'left'
                        ? windowInstance.div.offsetLeft + windowInstance.div.offsetWidth
                        : windowInstance.div.offsetLeft - dockedRailWidth
                ) + 'px';
            } else {
                rail.style.left = (
                    dockTarget === 'left'
                        ? collapsedRailInset
                        : window.innerWidth - collapsedRailInset - dockedRailWidth
                ) + 'px';
            }
        }

        function ensureToggleRail(windowInstance) {
            if (
                windowInstance.div == null ||
                windowInstance.div._mermaidToggleRail != null ||
                getManagedPanelRole(windowInstance) == null
            ) {
                return;
            }

            var toggleBtn = document.createElement('div');
            toggleBtn.className = 'mermaid-sidebar-toggle';
            toggleBtn.title = '收缩或展开面板';
            toggleBtn.tabIndex = 0;
            toggleBtn.setAttribute('role', 'button');
            toggleBtn.setAttribute('aria-label', '收缩或展开面板');

            var toggleCollapse = function(e) {
                if (e != null) {
                    if (typeof e.preventDefault === 'function') {
                        e.preventDefault();
                    }

                    if (typeof e.stopPropagation === 'function') {
                        e.stopPropagation();
                    }

                    if (typeof e.stopImmediatePropagation === 'function') {
                        e.stopImmediatePropagation();
                    }

                    if (typeof mxEvent !== 'undefined' && mxEvent.consume) {
                        mxEvent.consume(e);
                    }
                }

                var dockTarget = getDockTarget(windowInstance);

                if (dockTarget == null) {
                    return;
                }

                if (windowInstance.isVisible() && windowInstance.div.offsetWidth > 50) {
                    windowInstance.div._mermaidExpandedWidth = windowInstance.div.offsetWidth;
                }

                var actionName = getManagedPanelRole(windowInstance) === 'shapes' ? 'toggleShapes' : 'format';
                var editorUi = windowInstance._mermaidEditorUi || null;
                var action = editorUi != null && editorUi.actions != null ? editorUi.actions.get(actionName) : null;

                if (action != null && typeof action.funct === 'function') {
                    action.funct();
                } else {
                    windowInstance.setVisible(!windowInstance.isVisible());
                }
            };

            toggleBtn.addEventListener('mousedown', toggleCollapse, true);
            toggleBtn.addEventListener('click', toggleCollapse, true);
            toggleBtn.addEventListener('touchstart', toggleCollapse, { passive: false, capture: true });
            toggleBtn.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    toggleCollapse(e);
                }
            });

            document.body.appendChild(toggleBtn);
            windowInstance.div._mermaidToggleRail = toggleBtn;
        }

        function applyDockedWindowState(windowInstance, dockTarget) {
            if (getManagedPanelRole(windowInstance) == null) {
                hideToggleRail(windowInstance);
                return;
            }

            ensureToggleRail(windowInstance);

            if (dockTarget != null) {
                windowInstance.div.classList.add('mermaid-docked');

                if (dockTarget === 'left') {
                    windowInstance.div.classList.add('mermaid-docked-left');
                    windowInstance.div.classList.remove('mermaid-docked-right');
                } else {
                    windowInstance.div.classList.add('mermaid-docked-right');
                    windowInstance.div.classList.remove('mermaid-docked-left');
                }

                if (windowInstance.isVisible()) {
                    setWindowWidth(windowInstance, windowInstance.div._mermaidExpandedWidth);
                }

                windowInstance.div.classList.toggle('mermaid-docked-collapsed', !windowInstance.isVisible());

                if (windowInstance.resize != null) {
                    windowInstance.resize.style.display = windowInstance.isVisible() ? 'inline' : 'none';
                }

                updateToggleRail(windowInstance, dockTarget);
            } else {
                setWindowWidth(windowInstance, windowInstance.div._mermaidExpandedWidth);
                windowInstance.div.classList.remove('mermaid-docked', 'mermaid-docked-left', 'mermaid-docked-right', 'mermaid-docked-collapsed');

                if (windowInstance.resize != null) {
                    windowInstance.resize.style.display = windowInstance.isVisible() ? 'inline' : 'none';
                }

                hideToggleRail(windowInstance);
            }

            updateEditorUiLayout(windowInstance._mermaidEditorUi || null);
        }

        mxWindow.prototype.setLocation = function(x, y) {
            // Is this a panel window? We don't dock dialogs or context menus.
            var isDockable = this.title != null && getManagedPanelRole(this) != null;
            
            // 1. Prevent overlapping the top toolbar (y=0~44)
            if (y < 44) y = 44;

            // 2. Magnetic Docking and Collapse to sides
            if (isDockable) {
                // Initialize collapse state tracking AND the custom UI collapse button
                if (!this.div._mermaidToggleInit) {
                    this.div._mermaidToggleInit = true;
                    this.div._mermaidExpandedWidth = parseInt(this.div.style.width, 10) || 280;
                    this.div._mermaidInitialDockPending = true;
                    ensureToggleRail(this);
                }

                // If not collapsed and being dragged, track its width so we can restore it later
                var currentInlineWidth = parseInt(this.div.style.width, 10);
                if (this.isVisible() && currentInlineWidth > 50) {
                    this.div._mermaidExpandedWidth = currentInlineWidth;
                }

                var snapThreshold = 30;
                var edgeRight = window.innerWidth;
                var width = this.div._mermaidExpandedWidth;
                
                var dockTarget = null;
                var panelRole = getManagedPanelRole(this);
                
                if (this.div._mermaidInitialDockPending) {
                    dockTarget = panelRole === 'format' ? 'right' : 'left';
                    x = dockTarget === 'right' ? edgeRight - width : 0;
                    y = 44;
                    this.div._mermaidInitialDockPending = false;
                    this.div._mermaidDidInitialDock = true;
                } else if (x < snapThreshold) {
                    x = 0;
                    dockTarget = 'left';
                } else if (x + width > edgeRight - snapThreshold) {
                    x = edgeRight - width;
                    dockTarget = 'right';
                }

                if (dockTarget) {
                    y = 44; // Always snap to the top below the toolbar when docking
                    applyDockedWindowState(this, dockTarget);
                } else {
                    applyDockedWindowState(this, null);
                }
            }
            
            oldSetLoc.apply(this, [x, y]);
        };

        mxWindow.prototype.show = function() {
            oldShow.apply(this, arguments);

            if (this.div != null && getManagedPanelRole(this) != null) {
                if (this.div._mermaidDidInitialDock !== true) {
                    this.div._mermaidInitialDockPending = true;
                    this.setLocation(this.getX(), this.getY());
                } else {
                    applyDockedWindowState(this, getDockTarget(this));
                }
            }
        };

        mxWindow.prototype.hide = function() {
            oldHide.apply(this, arguments);

            if (this.div != null && getManagedPanelRole(this) != null) {
                applyDockedWindowState(this, getDockTarget(this));
            }
        };

        mxWindow.prototype.setSize = function(width, height) {
            oldSetSize.apply(this, arguments);

            if (this.div != null && getManagedPanelRole(this) != null) {
                if (width > 50) {
                    this.div._mermaidExpandedWidth = width;
                }

                applyDockedWindowState(this, getDockTarget(this));
            }
        };

        mxWindow.prototype.destroy = function() {
            var editorUi = this._mermaidEditorUi || null;

            if (this.div != null && this.div._mermaidToggleRail != null) {
                this.div._mermaidToggleRail.parentNode.removeChild(this.div._mermaidToggleRail);
                this.div._mermaidToggleRail = null;
            }

            oldDestroy.apply(this, arguments);
            updateEditorUiLayout(editorUi);
        };

        mxWindow.prototype.setTitle = function(title) {
            oldSetTitle.apply(this, arguments);
            var panelRole = getManagedPanelRole(this);

            if (this.div != null && panelRole != null) {
                ensureToggleRail(this);
                if (this.div._mermaidDidInitialDock !== true) {
                    this.div._mermaidInitialDockPending = true;
                }
                this.setLocation(this.getX(), this.getY());
            }
        };
    } else {
        setTimeout(initMermaidOverrides, 50);
    }
})();

(function initMermaidWrapperWindowOverride() {
    if (typeof WrapperWindow !== 'undefined') {
        var oldWrapperWindow = WrapperWindow;

        WrapperWindow = function(editorUi, title, x, y, w, h, fn, div) {
            oldWrapperWindow.apply(this, arguments);

            if (this.window != null) {
                this.window._mermaidEditorUi = editorUi;
            }
        };

        WrapperWindow.prototype = oldWrapperWindow.prototype;
        WrapperWindow.prototype.constructor = WrapperWindow;
    } else {
        setTimeout(initMermaidWrapperWindowOverride, 50);
    }
})();
