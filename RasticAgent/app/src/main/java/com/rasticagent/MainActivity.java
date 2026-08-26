package com.rasticagent;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

public class MainActivity extends Activity {
    private TextView chat; private EditText input;
    private SharedPreferences prefs;
    public SharedPreferences getPrefs(){return prefs;}
    @Override public void onCreate(Bundle b){super.onCreate(b); prefs=getSharedPreferences("agent",MODE_PRIVATE); buildUi();}
    private TextView tv(String s,int size){TextView t=new TextView(this);t.setText(s);t.setTextSize(size);t.setPadding(16,12,16,12);return t;}
    private void buildUi(){
        LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(Color.WHITE);
        TextView title=tv("Rastic Agent",22); title.setGravity(Gravity.CENTER); root.addView(title,new LinearLayout.LayoutParams(-1,60));
        LinearLayout bar=new LinearLayout(this); Button access=new Button(this);access.setText("فعال‌کردن کنترل گوشی");access.setOnClickListener(v->startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))); Button cfg=new Button(this);cfg.setText("تنظیمات API");cfg.setOnClickListener(v->apiSettings()); bar.addView(access,new LinearLayout.LayoutParams(0,60,1));bar.addView(cfg,new LinearLayout.LayoutParams(0,60,1));root.addView(bar);
        ScrollView sv=new ScrollView(this);chat=tv("پیام‌ها اینجا نمایش داده می‌شوند.\n",16);sv.addView(chat);root.addView(sv,new LinearLayout.LayoutParams(-1,0,1));
        LinearLayout send=new LinearLayout(this); input=new EditText(this);input.setHint("مثلاً: صفحه فعلی را بخوان"); Button go=new Button(this);go.setText("ارسال");go.setOnClickListener(v->send()); send.addView(input,new LinearLayout.LayoutParams(0,70,1));send.addView(go,new LinearLayout.LayoutParams(110,70));root.addView(send);setContentView(root);
    }
    private void send(){String s=input.getText().toString().trim();if(s.isEmpty())return;append("تو: "+s);input.setText("");append("Agent: در حال تحلیل...");new AgentCore(this).ask(s,r->runOnUiThread(()->append("Agent: "+r)));}
    private void append(String s){chat.append("\n"+s+"\n");}
    private void apiSettings(){
        LinearLayout l=new LinearLayout(this);l.setOrientation(LinearLayout.VERTICAL);EditText ep=new EditText(this);ep.setHint("Endpoint");ep.setText(prefs.getString("endpoint","https://api.openai.com/v1/chat/completions"));EditText key=new EditText(this);key.setHint("API Key");key.setInputType(129);key.setText(prefs.getString("apiKey",""));EditText model=new EditText(this);model.setHint("Model");model.setText(prefs.getString("model","gpt-5.4-mini"));l.addView(ep);l.addView(key);l.addView(model);Button save=new Button(this);save.setText("ذخیره");l.addView(save);final android.app.Dialog d=new android.app.AlertDialog.Builder(this).setTitle("تنظیمات AI").setView(l).create();save.setOnClickListener(v->{prefs.edit().putString("endpoint",ep.getText().toString().trim()).putString("apiKey",key.getText().toString().trim()).putString("model",model.getText().toString().trim()).apply();d.dismiss();Toast.makeText(this,"ذخیره شد",Toast.LENGTH_SHORT).show();});d.show();
    }
}
