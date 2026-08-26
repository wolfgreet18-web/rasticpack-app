package com.rasticagent;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.graphics.Rect;
import android.os.Bundle;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

import java.util.ArrayList;
import java.util.List;

public class AgentAccessibilityService extends AccessibilityService {
    private static AgentAccessibilityService instance;
    public static AgentAccessibilityService getInstance() { return instance; }

    @Override public void onServiceConnected() {
        super.onServiceConnected(); instance = this;
        AccessibilityServiceInfo info = getServiceInfo();
        info.flags |= AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS;
        setServiceInfo(info);
    }
    @Override public void onAccessibilityEvent(AccessibilityEvent event) {}
    @Override public void onInterrupt() {}
    @Override public void onDestroy() { if (instance == this) instance = null; super.onDestroy(); }

    public String readScreen() {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return "No active window content is available.";
        StringBuilder out = new StringBuilder();
        collect(root, out, 0);
        root.recycle();
        String s = out.toString().trim();
        return s.isEmpty() ? "Active window has no readable text/nodes." : s;
    }
    private void collect(AccessibilityNodeInfo node, StringBuilder out, int depth) {
        if (node == null || depth > 30 || out.length() > 18000) return;
        CharSequence text = node.getText();
        CharSequence desc = node.getContentDescription();
        CharSequence cls = node.getClassName();
        if ((text != null && text.length() > 0) || (desc != null && desc.length() > 0)) {
            out.append("- ");
            if (text != null) out.append(text);
            if (desc != null && (text == null || !desc.toString().equals(text.toString()))) out.append(" [").append(desc).append("]");
            if (cls != null) out.append(" <").append(cls).append(">");
            out.append('\n');
        }
        for (int i = 0; i < node.getChildCount(); i++) collect(node.getChild(i), out, depth + 1);
    }

    public boolean clickText(String target) {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return false;
        AccessibilityNodeInfo node = findText(root, target);
        boolean ok = false;
        if (node != null) {
            ok = node.performAction(AccessibilityNodeInfo.ACTION_CLICK);
            if (!ok && node.getParent() != null) ok = node.getParent().performAction(AccessibilityNodeInfo.ACTION_CLICK);
        }
        if (node != null) node.recycle();
        root.recycle();
        return ok;
    }
    private AccessibilityNodeInfo findText(AccessibilityNodeInfo node, String target) {
        CharSequence text = node.getText();
        CharSequence desc = node.getContentDescription();
        if ((text != null && text.toString().equalsIgnoreCase(target)) || (desc != null && desc.toString().equalsIgnoreCase(target))) return node;
        for (int i=0;i<node.getChildCount();i++) { AccessibilityNodeInfo r=findText(node.getChild(i), target); if (r!=null) return r; }
        return null;
    }
    public boolean setText(String target, String value) {
        AccessibilityNodeInfo root = getRootInActiveWindow(); if (root == null) return false;
        AccessibilityNodeInfo node = findTextField(root, target);
        boolean ok=false;
        if (node != null && node.isEditable()) { Bundle b=new Bundle(); b.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, value); ok=node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT,b); }
        if (node!=null) node.recycle(); root.recycle(); return ok;
    }
    private AccessibilityNodeInfo findTextField(AccessibilityNodeInfo node, String hint) {
        CharSequence t=node.getText(), d=node.getContentDescription();
        boolean match = hint==null || hint.isEmpty() || (t!=null&&t.toString().contains(hint)) || (d!=null&&d.toString().contains(hint));
        if (node.isEditable() && match) return node;
        for(int i=0;i<node.getChildCount();i++){AccessibilityNodeInfo r=findTextField(node.getChild(i),hint);if(r!=null)return r;}
        return null;
    }
    public boolean scrollForward() {
        AccessibilityNodeInfo root=getRootInActiveWindow(); if(root==null)return false;
        boolean ok=performScroll(root,true); root.recycle(); return ok;
    }
    public boolean scrollBackward() {
        AccessibilityNodeInfo root=getRootInActiveWindow(); if(root==null)return false;
        boolean ok=performScroll(root,false); root.recycle(); return ok;
    }
    private boolean performScroll(AccessibilityNodeInfo node, boolean forward) {
        if(node.isScrollable()) return node.performAction(forward?AccessibilityNodeInfo.ACTION_SCROLL_FORWARD:AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD) || anyChildScroll(node,forward);
        return anyChildScroll(node,forward);
    }
    private boolean anyChildScroll(AccessibilityNodeInfo node, boolean forward) { for(int i=0;i<node.getChildCount();i++) if(performScroll(node.getChild(i),forward)) return true; return false; }
    public boolean goBack(){ return performGlobalAction(GLOBAL_ACTION_BACK); }
    public boolean home(){ return performGlobalAction(GLOBAL_ACTION_HOME); }
}
