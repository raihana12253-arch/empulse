"""Name and text pools for the synthetic roster (all invented)."""

FEMALE_FIRST = ["Sara", "Fatima", "Aisha", "Mariam", "Reem", "Hanan", "Salma", "Amal", "Nada", "Ghada", "Lama",
                "Rawan", "Jood", "Abeer", "Sahar", "Wafa", "Haya", "Asma", "Dalia", "Rasha", "Samar", "Nour",
                "Shahd", "Tala", "Joury", "Lujain", "Najla", "Hind", "Manal", "Alia", "Basma", "Dima", "Ola",
                "Rania", "Zainab", "Khadija", "Hessa", "Maysa", "Suha", "Ranya", "Ihsan", "Marwa", "Amira", "Lubna"]
MALE_FIRST = ["Ahmed", "Mohammed", "Abdullah", "Yousef", "Hassan", "Ali", "Majed", "Nasser", "Saud", "Fahad",
              "Ibrahim", "Waleed", "Bandar", "Turki", "Salman", "Hamza", "Ziad", "Adel", "Karim", "Jamal", "Mazen",
              "Nabil", "Osama", "Rayan", "Sultan", "Talal", "Walid", "Yazan", "Zaid", "Anas", "Bilal", "Daoud",
              "Emad", "Firas", "Ghazi", "Hatem", "Imad", "Jihad", "Kamal", "Laith", "Murad", "Nizar", "Qasim",
              "Raed", "Saleh", "Tamer", "Wael", "Yahya", "Hisham", "Moath", "Badr", "Ayman", "Fadi", "Haitham"]
LAST = ["Haddad", "Mansour", "Zaki", "Nasser", "Youssef", "Khoury", "Farouk", "Al-Saud", "Rahman", "Al-Otaibi",
        "Saeed", "Hadi", "Aziz", "Farhat", "Al-Harbi", "Al-Ghamdi", "Al-Qahtani", "Al-Zahrani", "Al-Shehri",
        "Al-Dosari", "Al-Mutairi", "Al-Rashid", "Bakr", "Darwish", "Fakhri", "Ghanem", "Hamdan", "Idris", "Jaber",
        "Kassem", "Lahham", "Mahmoud", "Naser", "Othman", "Qureshi", "Rizk", "Salem", "Tamimi", "Wehbe", "Yassin",
        "Zahran", "Abboud", "Barakat", "Chehab", "Dajani", "Esmail", "Fares", "Gharib", "Habib", "Issa", "Jabr",
        "Kanaan", "Labib", "Masri", "Najjar", "Odeh", "Qadri", "Rafi", "Sabbagh", "Taha", "Zayed", "Al-Amri",
        "Al-Balushi", "Al-Hashimi", "Al-Jabri", "Al-Kuwari", "Bashir", "Dabbagh", "Hijazi"]

# Departments and teams now live in design_targets.py (DEPARTMENTS).
DEPT_EFFECT = {"Technology": 0.25, "Operations": 0.30, "Sales": 0.15, "Customer Success": 0.0,
               "Finance": -0.10, "People": -0.30}

IC_TITLES = {
    "Technology": {1: ["Junior Software Engineer", "QA Analyst"], 2: ["Software Engineer", "DevOps Engineer", "QA Engineer"],
                    3: ["Senior Software Engineer", "Senior SRE", "Security Engineer"], 4: ["Staff Engineer", "Principal Engineer"]},
    "Operations": {1: ["Operations Coordinator", "Support Agent"], 2: ["Operations Analyst", "Logistics Specialist"],
                   3: ["Senior Operations Analyst", "Procurement Lead"], 4: ["Operations Architect", "Principal Planner"]},
    "Sales": {1: ["Sales Associate", "Marketing Assistant"], 2: ["Account Executive", "Marketing Specialist"],
                          3: ["Senior Account Executive", "Senior Marketing Strategist"], 4: ["Principal Account Executive", "Marketing Lead"]},
    "Customer Success": {1: ["Customer Success Associate", "Support Specialist"], 2: ["Customer Success Manager", "Onboarding Specialist"],
                         3: ["Senior Customer Success Manager", "Renewals Lead"], 4: ["Principal Customer Success Manager", "Customer Success Architect"]},
    "Finance": {1: ["Finance Assistant"], 2: ["Accountant", "Financial Analyst"], 3: ["Senior Accountant", "Senior Financial Analyst"],
                4: ["Finance Lead", "Principal Financial Analyst"]},
    "People": {1: ["HR Assistant"], 2: ["HR Specialist", "Recruiter"], 3: ["Senior HR Specialist", "Learning Partner"],
                         4: ["People Lead", "Principal Recruiter"]},
}
MANAGER_TITLE = {"Technology": "Engineering Manager", "Operations": "Operations Manager",
                 "Sales": "Sales Manager", "Customer Success": "Customer Success Lead",
                 "Finance": "Finance Manager", "People": "People Manager"}

SKILLS = {
    "Technology": ["Python", "TypeScript", "Kubernetes", "Incident response", "System design", "CI/CD",
                    "Observability", "Security basics", "Code review", "Cloud (AWS/Azure)"],
    "Operations": ["Process improvement", "Supplier management", "Inventory planning", "Customer service",
                   "Safety compliance", "Forecasting", "Logistics", "Excel modelling", "Vendor negotiation", "Quality control"],
    "Sales": ["Negotiation", "CRM", "Content writing", "Campaign analytics", "Account planning",
                          "Presentation", "SEO", "Brand strategy", "Market research", "Partnership building"],
    "Customer Success": ["Account health reviews", "CRM", "Onboarding design", "Renewal planning", "Customer interviews",
                         "Escalation handling", "Product training", "Stakeholder management", "Churn analysis", "Customer surveys"],
    "Finance": ["Financial modelling", "Reporting", "Budgeting", "Risk analysis", "Audit", "Excel modelling",
                "Treasury", "Tax basics", "Forecasting", "Controls"],
    "People": ["Interviewing", "Coaching", "Employee relations", "Learning design", "Talent analytics",
                         "Onboarding", "Compensation", "Facilitation", "Change management", "Labour law basics"],
}
SOFT_SKILLS = ["Communication", "Collaboration", "Time management", "Mentoring", "Problem solving"]

IDEA_TITLES = {
    "Technology": ["Automate release checks", "Self-service staging environments", "Cut alert noise with smarter rules",
                    "Shared component library", "On-call handover template", "Faster build cache", "Dependency health dashboard"],
    "Operations": ["Barcode-free stock counts", "Shared supplier scorecard", "Predictive restock alerts",
                   "Shift swap board", "Route batching pilot", "Digital safety checklist", "Returns triage rules"],
    "Sales": ["Lead scoring refresh", "Reusable proposal blocks", "Customer story library",
                          "Webinar to demo funnel", "Partner referral kit", "Win/loss review ritual", "Localised email journeys"],
    "Customer Success": ["Health score early alerts", "Onboarding video library", "Renewal playbook refresh",
                         "Customer community forum", "Escalation routing rules", "Quarterly review template", "Support macro cleanup"],
    "Finance": ["Faster month-end close", "Invoice matching automation", "Cash forecast refresh",
                "Expense policy chatbot", "Vendor payment calendar", "Audit evidence vault", "Budget variance alerts"],
    "People": ["Onboarding buddy programme", "Skills marketplace pilot", "Manager 1:1 toolkit",
                         "Pulse survey follow-ups", "Internal mobility board", "Recognition rituals", "Exit insight loop"],
}
IDEA_CATEGORIES = ["Process", "Product", "Customer experience", "Cost saving", "People & culture", "Technology"]

RECOGNITION_TYPES = ["Impact", "Collaboration", "Innovation", "Mentorship", "Above & Beyond", "Customer Focus"]
RECOGNITION_MESSAGES = {
    "Impact": ["Delivered the migration ahead of plan and kept everyone informed.", "Your analysis changed the decision for the whole team.",
               "Closed a long-running issue that was blocking three teams."],
    "Collaboration": ["Always makes time to unblock others.", "Brought two teams together on a tough dependency.",
                      "Made the hand-over smooth for everyone involved."],
    "Innovation": ["Proposed a simpler way to do this and proved it with a pilot.", "Great idea, and thank you for following it through.",
                   "Turned a rough concept into something the team now uses daily."],
    "Mentorship": ["Spent real time helping a new joiner get productive.", "Patient, clear and generous with knowledge.",
                   "Thank you for the coaching sessions this quarter."],
    "Above & Beyond": ["Stepped in during a busy week without being asked.", "Went the extra mile for a customer escalation.",
                       "Picked up the slack calmly when we were short-staffed."],
    "Customer Focus": ["Customers keep mentioning how helpful you were.", "Turned a complaint into a thank-you.",
                       "Kept the customer's real need at the centre of the work."],
}

INTERVENTION_TYPES = {
    "workload_index": ("Workload rebalance", "Redistribute tasks and defer low-priority work for 6-8 weeks.", 3500),
    "overtime_hours_monthly": ("Overtime cap and time off", "Cap overtime and schedule recovery days.", 6000),
    "work_life_balance": ("Flexible schedule", "Offer flexible hours or hybrid days to restore work-life balance.", 1500),
    "job_satisfaction": ("Career conversation", "Hold a career and role-fit conversation with a growth plan.", 2000),
    "mood_score": ("Wellbeing check-in", "Confidential wellbeing check-in with optional EAP referral.", 2500),
    "engagement_score": ("Role enrichment", "Add a stretch project or ownership area aligned with strengths.", 3000),
    "recognition_90d": ("Recognition plan", "Plan visible recognition for recent contributions.", 500),
}

# Customer Insights and Analytics Platform are data teams inside Operations (H03).
DATA_TITLES = {1: ["Junior Data Analyst"], 2: ["Data Analyst", "Data Engineer"],
               3: ["Senior Data Analyst", "Senior Data Engineer", "Data Scientist"], 4: ["Staff Data Scientist", "Principal Analyst"]}
DATA_SKILLS = ["SQL", "Python", "Data storytelling", "Statistics", "Dashboards", "Machine learning",
               "Experiment design", "Data modelling", "Stakeholder management", "Data quality"]
DATA_TEAMS = {"Customer Insights", "Analytics Platform"}
