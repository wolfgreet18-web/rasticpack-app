package com.rasticagent;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class AgentCore {
    public interface Callback { void onResult(String text); }
    private final MainActivity activity;
    public AgentCore(MainActivity activity){this.activity=activity;}

    public void ask(final String userText, final Callback cb){
        new Thread(() -> {
            try {
                String base=activity.getPrefs().getString("endpoint","https://api.openai.com/v1/chat/completions");
                String key=activity.getPrefs().getString("apiKey","");
                String model=activity.getPrefs().getString("model","gpt-5.4-mini");
                if(key.isEmpty()){cb.onResult("API Key تنظیم نشده است. از تنظیمات Agent واردش کن.");return;}
                String screen=""; AgentAccessibilityService s=AgentAccessibilityService.getInstance(); if(s!=null) screen=s.readScreen();
                String system="You are Rastic Agent, an Android device assistant.\n"+
                    "You may request exactly ONE tool action per turn. Return ONLY valid JSON, no markdown.\n"+
                    "Tools: {\\\"action\\\":\\\"none\\\",\\\"message\\\":\\\"text\\\"}; {\\\"action\\\":\\\"click_text\\\",\\\"text\\\":\\\"text\\\"}; {\\\"action\\\":\\\"scroll_forward\\\"}; {\\\"action\\\":\\\"scroll_backward\\\"}; {\\\"action\\\":\\\"back\\\"}; {\\\"action\\\":\\\"home\\\"}; {\\\"action\\\":\\\"read_screen\\\"}.\n"+
                    "Use read_screen when you need to inspect the current screen. Never claim an action happened unless the tool result confirms it.\n"+
                    "Current screen:\n"+screen;
                JSONObject payload=new JSONObject(); JSONArray msgs=new JSONArray();
                msgs.put(new JSONObject().put("role","system").put("content",system));
                msgs.put(new JSONObject().put("role","user").put("content",userText));
                payload.put("model",model).put("messages",msgs).put("temperature",0.1);
                HttpURLConnection c=(HttpURLConnection)new URL(base).openConnection(); c.setRequestMethod("POST"); c.setDoOutput(true); c.setRequestProperty("Content-Type","application/json"); c.setRequestProperty("Authorization","Bearer "+key);
                byte[] body=payload.toString().getBytes(StandardCharsets.UTF_8); c.setFixedLengthStreamingMode(body.length); try(OutputStream os=c.getOutputStream()){os.write(body);} int code=c.getResponseCode();
                BufferedReader br=new BufferedReader(new InputStreamReader(code>=400?c.getErrorStream():c.getInputStream(),StandardCharsets.UTF_8)); StringBuilder sb=new StringBuilder(); String line; while((line=br.readLine())!=null)sb.append(line); c.disconnect();
                if(code>=400){cb.onResult("API خطا داد: HTTP "+code+"\n"+sb);return;}
                JSONObject resp=new JSONObject(sb.toString()); String content=resp.getJSONArray("choices").getJSONObject(0).getJSONObject("message").getString("content");
                cb.onResult(execute(content));
            }catch(Exception e){cb.onResult("خطا: "+e.getMessage());}
        }).start();
    }
    private String execute(String raw){
        try{
            JSONObject o=new JSONObject(raw.trim()); String a=o.optString("action","none"); AgentAccessibilityService s=AgentAccessibilityService.getInstance();
            if("none".equals(a)) return o.optString("message",raw);
            if(s==null) return "Accessibility فعال نیست. آن را از تنظیمات اندروید روشن کن.";
            boolean ok;
            switch(a){case "click_text": ok=s.clickText(o.optString("text")); break; case "scroll_forward":ok=s.scrollForward();break;case "scroll_backward":ok=s.scrollBackward();break;case "back":ok=s.goBack();break;case "home":ok=s.home();break;case "read_screen":return s.readScreen();default:return "عملیات ناشناخته: "+a;}
            return ok?"انجام شد: "+a:"انجام نشد: "+a;
        }catch(Exception e){return "خروجی AI قابل پردازش نبود:\n"+raw;}
    }
}
