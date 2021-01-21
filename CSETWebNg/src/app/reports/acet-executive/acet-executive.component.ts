import { Component, OnInit, AfterViewChecked, AfterViewInit } from '@angular/core';
import { Title, DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ReportService } from '../../services/report.service';
import { ACETService } from '../../services/acet.service';
import { MatDetailResponse, MaturityDomain, MaturityComponent, MaturityAssessment } from '../../models/mat-detail.model';
import { AcetDashboard } from '../../models/acet-dashboard.model';



@Component({
  selector: 'app-acet-executive',
  templateUrl: './acet-executive.component.html',
  styleUrls: ['../reports.scss', '../acet-reports.scss']
})
export class AcetExecutiveComponent implements OnInit {
  response: any = null;
  graphdata: any = [];
  maturityDetail: MaturityDomain[];
  domainDataList: any = [];

  // Maturity Rep Data
  matDetailResponse: MatDetailResponse;
  maturityDomain: MaturityDomain;
  maturityComponent: MaturityComponent;
  maturityAssessment: MaturityAssessment;
  acetDashboard: AcetDashboard;
  information: any;

  constructor(
    public reportSvc: ReportService,
    public acetSvc: ACETService,
    private titleService: Title,

  ) { }

  ngOnInit(): void {
    this.titleService.setTitle("Executive Report - ACET");
    
    this.acetSvc.getAssessmentInfromation().subscribe(
      (r: any) => {
        this.response = r;
      },
      error => console.log('Assessment Infromation Error: ' + (<Error>error).message)
    );
  
    this.acetSvc.getMatDetailList().subscribe(
      (data: any) => {
        // Format and connect donut data here
        console.log(data);
        data.forEach((domain: MaturityDomain) => {
          var domainData = { 
            domainName: domain.DomainName, 
            domainMaturity: domain.DomainMaturity, 
            targetPercentageAchieved: domain.TargetPercentageAchieved,
            graphdata: []}
          domain.Assessments.forEach((assignment: MaturityAssessment) => {
            var assesmentData = {
              "asseessmentFactor": assignment.AssessmentFactor,
              "sections": []
            }
            assignment.Components.forEach((component: MaturityComponent) => {
              var sectionData = [
                { "name": "Baseline", "value": component.Baseline },
                { "name": "Evolving", "value": component.Evolving }, 
                { "name": "Intermediate", "value": component.Intermediate },
                { "name": "Advanced", "value": component.Advanced },
                { "name": "Innovative", "value": component.Innovative }
              ]
              
              var sectonInfo = {
                "name": component.ComponentName,
                "data": sectionData
              }
              assesmentData.sections.push(sectonInfo);
            })
            domainData.graphdata.push(assesmentData);
          })
          this.domainDataList.push(domainData);
          this.domainDataList.reverse();
        })
        },
      error => {
        console.log('Error getting all documents: ' + (<Error>error).name + (<Error>error).message);
        console.log('Error getting all documents: ' + (<Error>error).stack);
      });

    this.acetSvc.getAcetDashboard().subscribe(
      (data: AcetDashboard) => {
        this.acetDashboard = data;

        for (let i = 0; i < this.acetDashboard.IRPs.length; i++) {
          this.acetDashboard.IRPs[i].Comment = this.acetSvc.interpretRiskLevel(this.acetDashboard.IRPs[i].RiskLevel);
        }
      },
      error => {
        console.log('Error getting all documents: ' + (<Error>error).name + (<Error>error).message);
        console.log('Error getting all documents: ' + (<Error>error).stack);
      });

  }

  isNaNValuevalue(value) {
    if (value == "NaN"){
      return 0
    } else {
      return value
    }
  }

}
