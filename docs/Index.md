# Indice

1. [Overview](./1_Overview.md)

2. [Architecture](./2_architecture/2_Architecture.md) 
   
   1. [Client Environment](./2_architecture/2_1_ClientEnv.md)
      
      1. [Extension](./2_architecture/2_1_ClientEnv/2_1_1_Extension.md)
      
      2. [Dashboard](./2_architecture/2_1_ClientEnv/2_1_2_Dashboard.md)
      
      3. [ZSH Plugin](./2_architecture/2_1_ClientEnv/2_1_3_ZSHPlugin.md)
   
   2. [Engine/Tool](./2_architecture/2_2_Engine_Tool.md)
      
      1. [Node.js Environment](./2_architecture/2_2_Engine_Tool/2_2_1_NodeJSEnv.md)
         
         1. [API Express](./2_architecture/2_2_Engine_Tool/2_2_1_NodeJSEnv/2_2_1_1_APIExpress.md)
         
         2. [Worker](./2_architecture/2_2_Engine_Tool/2_2_1_NodeJSEnv/2_2_1_2_Worker.md)
      
      2. [Nginx](./2_architecture/2_2_Engine_Tool/2_2_2_Nginx.md)
      
      3. [Redis](./2_architecture/2_2_Engine_Tool/2_2_3_Redis.md)
      
      4. [GraphDB](./2_architecture/2_2_Engine_Tool/2_2_4_GraphDB.md)

3. [Main Operational Flows](./3_main_operational_flows/3_Main_Operational_Flows.md)
   
   1. [Extension](./3_main_operational_flows/3_1_Extension.md)
      
      1. [Functional Requirements](./3_main_operational_flows/3_1_Extension/3_1_1_FR.md)
         
         1. [Global](./3_main_operational_flows/3_1_Extension/3_1_1_FR/3_1_1_1_Global.md)
         
         2. [Techstack](./3_main_operational_flows/3_1_Extension/3_1_1_FR/3_1_1_2_Techstack.md)
         
         3. [Analyzer](./3_main_operational_flows/3_1_Extension/3_1_1_FR/3_1_1_3_Analyzer.md)
         
         4. [Interceptor](./3_main_operational_flows/3_1_Extension/3_1_1_FR/3_1_1_4_Interceptor.md)
      
      2. [Use Cases](./3_main_operational_flows/3_1_Extension/3_1_2_UC.md)
         
         1. [Global](./3_main_operational_flows/3_1_Extension/3_1_2_UC/3_1_2_1_Global.md)
         
         2. [Techstack](./3_main_operational_flows/3_1_Extension/3_1_2_UC/3_1_2_2_Techstack.md)
         
         3. [Analyzer](./3_main_operational_flows/3_1_Extension/3_1_2_UC/3_1_2_3_Analyzer.md)
         
         4. [Interceptor](./3_main_operational_flows/3_1_Extension/3_1_2_UC/3_1_2_4_Interceptor.md)
      
      3. [Sequence Diagrams](./3_main_operational_flows/3_1_Extension/3_1_3_SD.md)
         
         1. [Global](./3_main_operational_flows/3_1_Extension/3_1_3_SD/3_1_3_1_Global.md)
         
         2. [Techstack](./3_main_operational_flows/3_1_Extension/3_1_3_SD/3_1_3_2_Techstack.md)
         
         3. [Analyzer](./3_main_operational_flows/3_1_Extension/3_1_3_SD/3_1_3_3_Analyzer.md)
         
         4. [Interceptor](./3_main_operational_flows/3_1_Extension/3_1_3_SD/3_1_3_4_Interceptor.md)
   
   2. [Dashboard](./3_main_operational_flows/3_2_Dashboard.md)
      
      1. [Functional Requirements](./3_main_operational_flows/3_2_Dashboard/3_2_1_FR.md)
         
         1. [Global](./3_main_operational_flows/3_2_Dashboard/3_2_1_FR/3_2_1_1_Global.md)
         
         2. [Http Requests](./3_main_operational_flows/3_2_Dashboard/3_2_1_FR/3_2_1_2_Http_Requests.md)
         
         3. [Findings](./3_main_operational_flows/3_2_Dashboard/3_2_1_FR/3_2_1_3_Findings.md)
         
         4. [Send PCAP](./3_main_operational_flows/3_2_Dashboard/3_2_1_FR/3_2_1_4_Send_PCAP.md)
         
         5. [Tool Status](./3_main_operational_flows/3_2_Dashboard/3_2_1_FR/3_2_1_5_Tool_Status.md)
         
         6. [OpenAPI](./3_main_operational_flows/3_2_Dashboard/3_2_1_FR/3_2_1_6_OpenAPI.md)
      
      2. [Use Cases](./3_main_operational_flows/3_2_Dashboard/3_2_2_UC.md)
         
         1. [Global](./3_main_operational_flows/3_2_Dashboard/3_2_2_UC/3_2_2_1_Global.md)
         
         2. [Http Requests](./3_main_operational_flows/3_2_Dashboard/3_2_2_UC/3_2_2_2_Http_Requests.md)
         
         3. [Findings](./3_main_operational_flows/3_2_Dashboard/3_2_2_UC/3_2_2_3_Findings.md)
         
         4. [Send PCAP](./3_main_operational_flows/3_2_Dashboard/3_2_2_UC/3_2_2_4_Send_PCAP.md)
         
         5. [Tool Status](./3_main_operational_flows/3_2_Dashboard/3_2_2_UC/3_2_2_5_Tool_Status.md)
         
         6. [OpenAPI](./3_main_operational_flows/3_2_Dashboard/3_2_2_UC/3_2_2_6_OpenAPI.md)
      
      3. [Sequence Diagrams](./3_main_operational_flows/3_2_Dashboard/3_2_3_SD.md)
         
         1. [Global](./3_main_operational_flows/3_2_Dashboard/3_2_3_SD/3_2_3_1_Global.md)
         
         2. [Http Requests](./3_main_operational_flows/3_2_Dashboard/3_2_3_SD/3_2_3_2_Http_Requests.md)
         
         3. [Findings](./3_main_operational_flows/3_2_Dashboard/3_2_3_SD/3_2_3_3_Findings.md)
         
         4. [Send PCAP](./3_main_operational_flows/3_2_Dashboard/3_2_3_SD/3_2_3_4_Send_PCAP.md)
         
         5. [Tool Status](./3_main_operational_flows/3_2_Dashboard/3_2_3_SD/3_2_3_5_Tool_Status.md)
         
         6. [OpenAPI](./3_main_operational_flows/3_2_Dashboard/3_2_3_SD/3_2_3_6_OpenAPI.md)
   
   3. [ZSH Plugin](./3_main_operational_flows/3_3_ZSHPlugin.md)
      
      1. [Functional Requirements](./3_main_operational_flows/3_3_ZSHPlugin/3_3_1_FR.md)
      
      2. [Use Cases](./3_main_operational_flows/3_3_ZSHPlugin/3_3_2_UC.md)
      
      3. [Sequence Diagrams](./3_main_operational_flows/3_3_ZSHPlugin/3_3_3_SD.md)

---
