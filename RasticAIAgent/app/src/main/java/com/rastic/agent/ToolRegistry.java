package com.rastic.agent;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * محل ثبت مرکزی همه‌ی Toolهای موجود. Agent فقط از این طریق به Toolها
 * دسترسی دارد؛ یعنی AI هرگز نمی‌تواند کد دلخواه اجرا کند و فقط
 * می‌تواند Toolهایی را که اینجا ثبت شده صدا بزند.
 */
public class ToolRegistry {

    private final Map<String, Tool> tools = new LinkedHashMap<>();

    public void register(Tool tool) {
        tools.put(tool.name(), tool);
    }

    public Tool get(String name) {
        return tools.get(name);
    }

    public Map<String, Tool> all() {
        return tools;
    }

    /** توضیح همه‌ی Toolها برای فرستادن به AI به‌عنوان بخشی از system prompt. */
    public String describeAll() {
        StringBuilder sb = new StringBuilder();
        for (Tool t : tools.values()) {
            sb.append("- ").append(t.name()).append(": ").append(t.description()).append("\n");
        }
        return sb.toString();
    }
}
