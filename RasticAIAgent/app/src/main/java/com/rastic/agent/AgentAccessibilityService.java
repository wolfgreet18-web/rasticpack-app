package com.rastic.agent;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.graphics.Path;
import android.graphics.Rect;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

/**
 * سرویس Accessibility که قابلیت "دیدن" و "لمس‌کردن" صفحه را به Agent
 * می‌دهد. تمام Toolهای مربوط به تعامل با صفحه (کلیک، اسکرول، خواندن
 * متن) از طریق این سرویس اجرا می‌شوند.
 *
 * این کلاس یک instance استاتیک نگه می‌دارد تا Toolها بتوانند بدون
 * پیچیدگی bind/unbind به آن دسترسی داشته باشند؛ ساده‌ترین راه برای
 * نسخه‌ی اول (v1).
 */
public class AgentAccessibilityService extends AccessibilityService {

    private static AgentAccessibilityService instance;

    public static AgentAccessibilityService getInstance() {
        return instance;
    }

    public static boolean isRunning() {
        return instance != null;
    }

    @Override
    public void onServiceConnected() {
        super.onServiceConnected();
        instance = this;
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        // برای v1 نیازی به گوش‌دادن مداوم به رویدادها نداریم؛
        // خواندن صفحه به‌صورت on-demand در readScreen() انجام می‌شود.
    }

    @Override
    public void onInterrupt() {
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (instance == this) instance = null;
    }

    /** خواندن متن قابل‌مشاهده در صفحه فعلی، به‌صورت یک متن ساده خط‌به‌خط. */
    public String readScreen() {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return "(صفحه‌ای برای خواندن در دسترس نیست)";
        StringBuilder sb = new StringBuilder();
        collectText(root, sb);
        String result = sb.toString().trim();
        return result.isEmpty() ? "(متنی روی صفحه پیدا نشد)" : result;
    }

    private void collectText(AccessibilityNodeInfo node, StringBuilder sb) {
        if (node == null) return;
        CharSequence text = node.getText();
        CharSequence desc = node.getContentDescription();
        if (text != null && text.length() > 0) sb.append(text).append("\n");
        else if (desc != null && desc.length() > 0) sb.append(desc).append("\n");
        for (int i = 0; i < node.getChildCount(); i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child != null) {
                collectText(child, sb);
                child.recycle();
            }
        }
    }

    /** جستجوی یک node که متنش شامل the given text باشد و کلیک روی آن. */
    public boolean clickByText(String targetText) {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return false;
        AccessibilityNodeInfo found = findByText(root, targetText);
        if (found == null) return false;
        return clickNode(found);
    }

    private AccessibilityNodeInfo findByText(AccessibilityNodeInfo node, String target) {
        if (node == null) return null;
        CharSequence text = node.getText();
        CharSequence desc = node.getContentDescription();
        if (text != null && text.toString().contains(target)) return node;
        if (desc != null && desc.toString().contains(target)) return node;
        for (int i = 0; i < node.getChildCount(); i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child != null) {
                AccessibilityNodeInfo result = findByText(child, target);
                if (result != null) return result;
                child.recycle();
            }
        }
        return null;
    }

    private boolean clickNode(AccessibilityNodeInfo node) {
        AccessibilityNodeInfo current = node;
        while (current != null) {
            if (current.isClickable()) {
                return current.performAction(AccessibilityNodeInfo.ACTION_CLICK);
            }
            current = current.getParent();
        }
        // اگر هیچ node قابل‌کلیکی پیدا نشد، از طریق مختصات gesture انجام می‌دهیم.
        Rect bounds = new Rect();
        node.getBoundsInScreen(bounds);
        return tapAt(bounds.centerX(), bounds.centerY());
    }

    /** لمس یک نقطه‌ی مشخص از صفحه با gesture. */
    public boolean tapAt(int x, int y) {
        Path path = new Path();
        path.moveTo(x, y);
        GestureDescription.Builder builder = new GestureDescription.Builder();
        builder.addStroke(new GestureDescription.StrokeDescription(path, 0, 50));
        return dispatchGesture(builder.build(), null, null);
    }

    /** دکمه Back سیستم. */
    public boolean pressBack() {
        return performGlobalAction(GLOBAL_ACTION_BACK);
    }

    /** دکمه Home سیستم. */
    public boolean pressHome() {
        return performGlobalAction(GLOBAL_ACTION_HOME);
    }

    /** اسکرول به سمت پایین در صفحه فعلی. */
    public boolean scrollForward() {
        return performScrollAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD);
    }

    /** اسکرول به سمت بالا در صفحه فعلی. */
    public boolean scrollBackward() {
        return performScrollAction(AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD);
    }

    private boolean performScrollAction(int action) {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return false;
        AccessibilityNodeInfo scrollable = findScrollable(root);
        if (scrollable == null) return false;
        return scrollable.performAction(action);
    }

    private AccessibilityNodeInfo findScrollable(AccessibilityNodeInfo node) {
        if (node == null) return null;
        if (node.isScrollable()) return node;
        for (int i = 0; i < node.getChildCount(); i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child != null) {
                AccessibilityNodeInfo result = findScrollable(child);
                if (result != null) return result;
                child.recycle();
            }
        }
        return null;
    }
}
