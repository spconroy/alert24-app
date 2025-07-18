var h={},E=(y,v,$)=>(h.__chunk_5856=(w,u,f)=>{"use strict";f.d(u,{y:()=>b});class x{constructor(){let a=process.env.SENDGRID_API_KEY;if(!a){console.warn("SENDGRID_API_KEY not found. Email functionality disabled."),this.enabled=!1;return}this.apiKey=a,this.enabled=!0,this.fromEmail=process.env.SENDGRID_FROM_EMAIL||"noreply@alert24.io",this.sendgridApiUrl="https://api.sendgrid.com/v3/mail/send"}isEnabled(){return this.enabled}async sendEmail({to:a,subject:l,htmlContent:e,textContent:t,organizationBranding:r=null}){if(!this.enabled)return console.log(`Email disabled - would send: ${l} to ${a}
${t}`),{success:!1,error:"Email service not configured"};try{let i=r?.name||"Alert24";this.fromEmail;let o={personalizations:[{to:[{email:a}],subject:l}],from:{email:this.fromEmail,name:i},content:[{type:"text/plain",value:t},{type:"text/html",value:e}]},n=await fetch(this.sendgridApiUrl,{method:"POST",headers:{Authorization:`Bearer ${this.apiKey}`,"Content-Type":"application/json"},body:JSON.stringify(o)});if(!n.ok){let p=await n.text();throw Error(`SendGrid API error: ${n.status} - ${p}`)}return console.log(`Email sent successfully to ${a}: ${l}`),{success:!0,messageId:n.headers.get("x-message-id")}}catch(i){return console.error("Email sending failed:",i),{success:!1,error:i.message}}}async sendInvitationEmail({toEmail:a,toName:l,organizationName:e,inviterName:t,role:r,invitationLink:i,expiresAt:o,organizationBranding:n=null}){let p=new Date(o).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"}),c=`You're invited to join ${e} on Alert24`,d=`
Hi ${l||"there"},

${t} has invited you to join ${e} as a ${r}.

Accept your invitation by clicking this link:
${i}

This invitation will expire on ${p}.

If you don't have an Alert24 account yet, you'll be able to sign up using your Google account when you accept the invitation.

Best regards,
The Alert24 Team
    `.trim(),s=`
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Join ${e} on Alert24</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0; 
            padding: 0; 
            background-color: #f5f5f5; 
        }
        .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: white; 
            border-radius: 8px; 
            overflow: hidden; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
        }
        .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 30px 40px; 
            text-align: center; 
        }
        .content { 
            padding: 40px; 
        }
        .button { 
            display: inline-block; 
            background: #667eea; 
            color: white; 
            padding: 14px 28px; 
            text-decoration: none; 
            border-radius: 6px; 
            font-weight: bold; 
            margin: 20px 0; 
        }
        .footer { 
            background: #f8f9fa; 
            padding: 20px 40px; 
            text-align: center; 
            color: #666; 
            font-size: 14px; 
        }
        .role-badge { 
            background: #e3f2fd; 
            color: #1976d2; 
            padding: 4px 12px; 
            border-radius: 20px; 
            font-size: 14px; 
            font-weight: 500; 
        }
        .org-logo { 
            max-height: 40px; 
            max-width: 200px; 
            margin-bottom: 10px; 
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            ${n?.logoUrl?`<img src="${n.logoUrl}" alt="${e}" class="org-logo">`:""}
            <h1 style="margin: 0; font-size: 24px;">You're Invited!</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Join ${e} on Alert24</p>
        </div>
        
        <div class="content">
            <p>Hi ${l||"there"},</p>
            
            <p><strong>${t}</strong> has invited you to join <strong>${e}</strong> with the role of <span class="role-badge">${r}</span>.</p>
            
            <p>Alert24 is an incident management and monitoring platform that helps teams track service health, manage incidents, and communicate with stakeholders during outages.</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="${i}" class="button">Accept Invitation</a>
            </div>
            
            <p style="font-size: 14px; color: #666;">
                This invitation will expire on <strong>${p}</strong>.
            </p>
            
            <p style="font-size: 14px; color: #666;">
                If you don't have an Alert24 account yet, you'll be able to sign up using your Google account when you accept the invitation.
            </p>
        </div>
        
        <div class="footer">
            <p>This email was sent by Alert24 on behalf of ${e}.</p>
            <p>If you received this email by mistake, you can safely ignore it.</p>
        </div>
    </div>
</body>
</html>
    `.trim();return this.sendEmail({to:a,subject:c,htmlContent:s,textContent:d,organizationBranding:n})}async sendIncidentNotification({toEmail:a,toName:l,organizationName:e,incidentTitle:t,incidentDescription:r,severity:i,status:o,incidentUrl:n,organizationBranding:p=null}){let c={critical:"#d32f2f",high:"#f57c00",medium:"#1976d2",low:"#388e3c",maintenance:"#7b1fa2"},d={open:"New Incident",investigating:"Investigating",identified:"Issue Identified",monitoring:"Monitoring",resolved:"Resolved"},s=`[${i.toUpperCase()}] ${d[o]}: ${t}`,g=`
${d[o].toUpperCase()}

Incident: ${t}
Severity: ${i.toUpperCase()}
Organization: ${e}

Description:
${r}

View the full incident details and updates:
${n}

This is an automated notification from Alert24.
    `.trim(),m=`
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Incident Alert: ${t}</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0; 
            padding: 0; 
            background-color: #f5f5f5; 
        }
        .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: white; 
            border-radius: 8px; 
            overflow: hidden; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
        }
        .header { 
            background: ${c[i]||"#666"}; 
            color: white; 
            padding: 30px 40px; 
            text-align: center; 
        }
        .content { 
            padding: 40px; 
        }
        .incident-details { 
            background: #f8f9fa; 
            border: 1px solid #e9ecef; 
            border-radius: 6px; 
            padding: 20px; 
            margin: 20px 0; 
        }
        .button { 
            display: inline-block; 
            background: ${c[i]||"#666"}; 
            color: white; 
            padding: 14px 28px; 
            text-decoration: none; 
            border-radius: 6px; 
            font-weight: bold; 
            margin: 20px 0; 
        }
        .severity-badge { 
            background: ${c[i]||"#666"}; 
            color: white; 
            padding: 4px 12px; 
            border-radius: 20px; 
            font-size: 12px; 
            font-weight: bold; 
            text-transform: uppercase; 
        }
        .status-badge { 
            background: #e3f2fd; 
            color: #1976d2; 
            padding: 4px 12px; 
            border-radius: 20px; 
            font-size: 12px; 
            font-weight: 500; 
        }
        .footer { 
            background: #f8f9fa; 
            padding: 20px 40px; 
            text-align: center; 
            color: #666; 
            font-size: 14px; 
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="margin: 0; font-size: 24px;">\u26A0\uFE0F ${d[o]}</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">${e}</p>
        </div>
        
        <div class="content">
            <h2 style="margin-top: 0; color: ${c[i]||"#666"};">${t}</h2>
            
            <div style="margin: 20px 0;">
                <span class="severity-badge">${i}</span>
                <span class="status-badge">${d[o]}</span>
            </div>
            
            <div class="incident-details">
                <h3 style="margin: 0 0 10px 0; font-size: 16px;">Description</h3>
                <p style="margin: 0; white-space: pre-wrap;">${r}</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="${n}" class="button">View Incident Details</a>
            </div>
            
            <p style="font-size: 14px; color: #666;">
                You're receiving this notification because you're part of the ${e} incident response team.
            </p>
        </div>
        
        <div class="footer">
            <p>This is an automated notification from Alert24.</p>
            <p>To manage your notification preferences, visit your account settings.</p>
        </div>
    </div>
</body>
</html>
    `.trim();return this.sendEmail({to:a,subject:s,htmlContent:m,textContent:g,organizationBranding:p})}async sendMonitoringAlert({toEmail:a,toName:l,organizationName:e,serviceName:t,checkName:r,alertType:i,errorMessage:o,responseTime:n,checkUrl:p,organizationBranding:c=null}){let d={down:{subject:`\u{1F534} Service Down: ${t}`,color:"#d32f2f",icon:"\u{1F534}",statusText:"DOWN"},up:{subject:`\u2705 Service Recovered: ${t}`,color:"#4caf50",icon:"\u2705",statusText:"RECOVERED"},degraded:{subject:`\u26A0\uFE0F Service Degraded: ${t}`,color:"#ff9800",icon:"\u26A0\uFE0F",statusText:"DEGRADED"}},s=d[i]||d.down,g=`
${s.statusText}: ${t}

Check: ${r}
Organization: ${e}
${n?`Response Time: ${n}ms`:""}
${o?`Error: ${o}`:""}

This is an automated monitoring alert from Alert24.
    `.trim(),m=`
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${s.subject}</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0; 
            padding: 0; 
            background-color: #f5f5f5; 
        }
        .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: white; 
            border-radius: 8px; 
            overflow: hidden; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
        }
        .header { 
            background: ${s.color}; 
            color: white; 
            padding: 30px 40px; 
            text-align: center; 
        }
        .content { 
            padding: 40px; 
        }
        .alert-details { 
            background: #f8f9fa; 
            border: 1px solid #e9ecef; 
            border-radius: 6px; 
            padding: 20px; 
            margin: 20px 0; 
        }
        .footer { 
            background: #f8f9fa; 
            padding: 20px 40px; 
            text-align: center; 
            color: #666; 
            font-size: 14px; 
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="margin: 0; font-size: 24px;">${s.icon} ${s.statusText}</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">${t}</p>
        </div>
        
        <div class="content">
            <h2 style="margin-top: 0;">${r}</h2>
            
            <div class="alert-details">
                <p><strong>Service:</strong> ${t}</p>
                <p><strong>Organization:</strong> ${e}</p>
                ${n?`<p><strong>Response Time:</strong> ${n}ms</p>`:""}
                ${o?`<p><strong>Error:</strong> ${o}</p>`:""}
                <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            </div>
            
            <p style="font-size: 14px; color: #666;">
                This is an automated monitoring alert. Please check your service status and take appropriate action if needed.
            </p>
        </div>
        
        <div class="footer">
            <p>This is an automated notification from Alert24.</p>
            <p>Monitoring powered by ${e}</p>
        </div>
    </div>
</body>
</html>
    `.trim();return this.sendEmail({to:a,subject:s.subject,htmlContent:m,textContent:g,organizationBranding:c})}}let b=new x},h);export{E as __getNamedExports};
