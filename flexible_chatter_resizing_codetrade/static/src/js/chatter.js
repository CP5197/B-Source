/** @odoo-module **/

import { Chatter } from "@mail/core/web/chatter";
import { patch } from "@web/core/utils/patch";
import { onMounted, useState, useEffect } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

async function loadChatterPrefs(orm, userId) {
    const defaults = { chatter_position: "side", chatter_width: 450, chatter_collapsed: false };
    try {
        const result = await orm.read("res.users", [userId], ["chatter_position", "chatter_width", "chatter_collapsed"]);
        if (result && result.length) {
            defaults.chatter_position = result[0].chatter_position || "side";
            defaults.chatter_width = result[0].chatter_width || 450;
            defaults.chatter_collapsed = result[0].chatter_collapsed || false;
        }
    } catch (e) {
        console.warn("[FlexibleChatter] Prefs load failed", e);
    }
    return defaults;
}

async function saveChatterPrefs(orm, userId, vals) {
    try {
        await orm.write("res.users", [userId], vals);
    } catch (e) { }
}

patch(Chatter.prototype, {
    setup() {
        super.setup(...arguments);
        this.orm = useService("orm");
        this.userService = useService("user");
        this.ui = useService("ui");

        this.flexState = useState({
            isResizing: false,
            width: 450,
            collapsed: false,
            position: "side",
            prefsLoaded: false,
            showToggle: false,
        });

        onMounted(async () => {
            const prefs = await loadChatterPrefs(this.orm, this.userService.userId);
            this.flexState.width = prefs.chatter_width || 450;
            this.flexState.collapsed = prefs.chatter_collapsed || false;
            this.flexState.position = prefs.chatter_position || "side";
            this.flexState.prefsLoaded = true;
            this._applyFlexStyle();
        });

        useEffect(
            () => {
                if (this.flexState.prefsLoaded) this._applyFlexStyle();
            },
            () => [this.flexState.width, this.flexState.collapsed, this.flexState.prefsLoaded, this.flexState.position]
        );
    },

    _applyFlexStyle() {
        const el = this.rootRef?.el;
        if (!el) return;

        const container = el.closest(".o-mail-ChatterContainer, .o-mail-Form-chatter");
        const formSheetBg = container?.parentElement?.querySelector(".o_form_sheet_bg");

        // Handle Side/Bottom toggle by manipulating the o-aside class
        if (container) {
            if (this.flexState.position === "bottom") {
                container.classList.remove("o-aside");
                container.classList.add("o_flex_bottom"); // For our SCSS
            } else if (this.ui.size >= 6) { // SIZES.XXL is 6
                container.classList.add("o-aside");
                container.classList.remove("o_flex_bottom");
            }
        }

        if (this.flexState.collapsed) {
            el.classList.add("o_flex_collapsed");
            if (container) {
                container.style.width = "40px";
                container.style.minWidth = "40px";
                container.style.flex = "0 0 40px";
                container.classList.add("o_flex_container_collapsed");
            }
            if (formSheetBg && this.flexState.position === "side") {
                formSheetBg.style.flex = "1 1 100%";
                formSheetBg.style.maxWidth = "calc(100% - 40px)";
                formSheetBg.style.minWidth = "0";
            }
        } else {
            el.classList.remove("o_flex_collapsed");
            if (container) container.classList.remove("o_flex_container_collapsed");

            const isAside = container?.classList.contains("o-aside");
            if (isAside) {
                const w = this.flexState.width + "px";
                el.style.width = w;
                if (container) {
                    container.style.width = w;
                    container.style.flex = `0 0 ${w}`;
                    container.style.minWidth = "";
                }
                if (formSheetBg) {
                    formSheetBg.style.flex = "1 1 auto";
                    formSheetBg.style.maxWidth = "none";
                    formSheetBg.style.minWidth = "0";
                }
            } else {
                el.style.width = "";
                if (container) {
                    container.style.width = "";
                    container.style.flex = "";
                    container.style.minWidth = "";
                }
                if (formSheetBg) {
                    formSheetBg.style.flex = "";
                    formSheetBg.style.maxWidth = "";
                }
            }
        }
    },

    flexToggleChatter() {
        this.flexState.collapsed = !this.flexState.collapsed;
    },

    flexOnResizeStart(ev) {
        ev.preventDefault();
        this.flexState.isResizing = true;
        this._flexStartX = ev.clientX;
        this._flexStartWidth = this.flexState.width;
        this._flexOnMouseMove = (e) => {
            const dx = this._flexStartX - e.clientX;
            this.flexState.width = Math.max(300, Math.min(1000, this._flexStartWidth + dx));
        };
        this._flexOnMouseUp = () => {
            this.flexState.isResizing = false;
            document.removeEventListener("mousemove", this._flexOnMouseMove);
            document.removeEventListener("mouseup", this._flexOnMouseUp);
            document.body.style.cursor = "";
            saveChatterPrefs(this.orm, this.userService.userId, {
                chatter_width: this.flexState.width
            });
        };
        document.addEventListener("mousemove", this._flexOnMouseMove);
        document.addEventListener("mouseup", this._flexOnMouseUp);
        document.body.style.cursor = "col-resize";
    },

    flexOnMouseEnter() {
        this.flexState.showToggle = true;
    },
    flexOnMouseLeave() {
        this.flexState.showToggle = false;
    },
});
