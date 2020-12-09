////////////////////////////////
//
//   Copyright 2020 Battelle Energy Alliance, LLC
//
//  Permission is hereby granted, free of charge, to any person obtaining a copy
//  of this software and associated documentation files (the "Software"), to deal
//  in the Software without restriction, including without limitation the rights
//  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
//  copies of the Software, and to permit persons to whom the Software is
//  furnished to do so, subject to the following conditions:
//
//  The above copyright notice and this permission notice shall be included in all
//  copies or substantial portions of the Software.
//
//  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
//  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
//  SOFTWARE.
//
////////////////////////////////
import { Component, Input, OnInit, ViewChild, Output, EventEmitter } from '@angular/core';
import { Answer, Question, SubCategory, SubCategoryAnswers } from '../../../models/questions.model';
import { QuestionsService } from '../../../services/questions.service';
import { MatDialogRef, MatDialog } from '@angular/material/dialog';
import { InlineParameterComponent } from '../../../dialogs/inline-parameter/inline-parameter.component';
import { ConfigService } from '../../../services/config.service';
import { AssessmentService } from '../../../services/assessment.service';
import { QuestionFilterService } from '../../../services/question-filter.service';

/**
 * Represents the display container of a single subcategory with its member questions.
 */
@Component({
  selector: 'app-question-block',
  templateUrl: './question-block.component.html',
  styleUrls: ['./question-block.component.css']
})
export class QuestionBlockComponent implements OnInit {

  @Input() mySubCategory: SubCategory;

  @ViewChild('extrasComponent') extrasComponent;

  percentAnswered = 0;

  @Output() changeComponents = new EventEmitter();

  dialogRef: MatDialogRef<InlineParameterComponent>;
  answer: Answer;

  matLevelMap = new Map<string, string>();
  private _timeoutId: NodeJS.Timeout;

  altTextPlaceholder = "Description, explanation and/or justification for alternate answer";
  altTextPlaceholder_ACET = "Description, explanation and/or justification for compensating control";

  /**
   * 
   * @param questionsSvc 
   * @param filterSvc 
   * @param dialog 
   * @param configSvc 
   * @param assessSvc 
   */
  constructor(
    public questionsSvc: QuestionsService,
    public filterSvc: QuestionFilterService,
    private dialog: MatDialog,
    public configSvc: ConfigService,
    public assessSvc: AssessmentService) {
    this.matLevelMap.set("B", "Baseline");
    this.matLevelMap.set("E", "Evolving");
    this.matLevelMap.set("Int", "Intermediate");
    this.matLevelMap.set("A", "Advanced");
    this.matLevelMap.set("Inn", "Innovative");
  }

  /**
   * 
   */
  ngOnInit() {
    this.refreshReviewIndicator();
    this.refreshPercentAnswered();

    if (this.configSvc.acetInstallation) {
      this.altTextPlaceholder = this.altTextPlaceholder_ACET;
    }
  }

  /**
   * Replace parameter placeholders in the question text template with any overridden values.
   * @param q
   */
  applyTokensToText(q: Question) {
    if (!q.ParmSubs) {
      return q.QuestionText;
    }

    let text = q.QuestionText;

    q.ParmSubs.forEach(t => {
      let s = t.Substitution;
      if (s == null) {
        s = t.Token;
      }
      text = this.replaceAll(text, t.Token, "<span class='sub-me pid-" + t.Id + "'>" + s + "</span>");
    });

    return text;
  }

  /**
   * 
   * @param q 
   */
  baselineLevel(q: Question) {
    return this.matLevelMap.get(q.MaturityLevel.toString());
  }

  /**
   * 
   */
  refreshComponentOverrides() {
    this.changeComponents.emit();
  }

  /**
   * 
   * @param ans 
   */
  showThisOption(ans: string) {
    if (!this.questionsSvc.questions) {
      return true;
    }
    return this.questionsSvc.questions?.AnswerOptions.indexOf(ans) >= 0;
  }

  /**
   * Spawns a dialog to capture the new substitution text.
   */
  questionTextClicked(q: Question, e: Event) {
    const target: Element = (e.target || e.srcElement || e.currentTarget) as Element;
    const parameterId = this.getParameterId(target);

    // If they did not click on a parameter, do nothing
    if (parameterId === 0) {
      return;
    }

    this.dialogRef = this.dialog.open(InlineParameterComponent,
      {
        data: {
          question: q,
          clickedToken: e.srcElement,
          parameterId: parameterId
        },
        disableClose: false
      });
    this.dialogRef.afterClosed().subscribe(result => {
      q.Answer_Id = result.AnswerId;

      q.ParmSubs.find(s => s.Id === parameterId).Substitution = result.Substitution;
      this.applyTokensToText(q);
      this.dialogRef = null;
    });
  }

  /**
   * Parses the parameterid from the clicked element's class list, e.g. pid-1234
   * @param token
   */
  getParameterId(token: Element) {
    let id: number = 0;

    if (!token.classList) {
      return id;
    }

    for (let i = 0; i < token.classList.length; i++) {
      if (token.classList[i].substring(0, 4) === 'pid-') {
        id = Number(token.classList[i].substring(4));
      }
    }

    return id;
  }

  /**
   * Looks at all questions in the subcategory to see if any
   * are marked for review.
   * Also returns true if alt text is required but not supplied.
   */
  refreshReviewIndicator() {
    this.mySubCategory.HasReviewItems = false;
    this.mySubCategory.Questions.forEach(q => {
      if (q.MarkForReview) {
        this.mySubCategory.HasReviewItems = true;
        return;
      }
      if (q.Answer == 'A' && this.isAltTextRequired(q)) {
        this.mySubCategory.HasReviewItems = true;
        return;
      }
    });
  }

  /**
   * Calculates the percentage of answered questions for this subcategory.
   * The percentage for maturity questions is calculated using questions
   * that are within the assessment's target level.  
   */
  refreshPercentAnswered() {
    let answeredCount = 0;
    let totalCount = 0;

    this.mySubCategory.Questions.forEach(q => {
      if (q.Is_Maturity) {
        if (q.MaturityLevel <= this.assessSvc.assessment?.MaturityTargetLevel) {
          totalCount++;
          if (q.Answer && q.Answer !== "U") {
            answeredCount++;
          }
        }
      } else {
        totalCount++;
        if (q.Answer && q.Answer !== "U") {
          answeredCount++;
        }
      }
    });
    this.percentAnswered = (answeredCount / totalCount) * 100;
  }

  /**
   * Send a block of answers to the API for all my questions.
   * This is used when selecting "N" or "NA" at the subcategory
   * level.  All of the subcategory questions are answered en masse.
   * @param ans
   */
  setBlockAnswer(ans: string) {
    // if they clicked on the same answer that was previously set, "un-set" it
    if (this.mySubCategory.SubCategoryAnswer === ans) {
      ans = "U";
    }

    this.mySubCategory.SubCategoryAnswer = ans;

    const subCatAnswers: SubCategoryAnswers = {
      GroupHeadingId: this.mySubCategory.GroupHeadingId,
      SubCategoryId: this.mySubCategory.SubCategoryId,
      SubCategoryAnswer: this.mySubCategory.SubCategoryAnswer,
      Answers: []
    };

    // Bundle all of the member questions for this subcategory into the request
    this.mySubCategory.Questions.forEach(q => {

      // set all questions' answers if N or NA or U
      if (ans === 'N' || ans === 'NA' || ans === 'U') {
        q.Answer = ans;
      }

      const answer: Answer = {
        QuestionId: q.QuestionId,
        QuestionNumber: q.DisplayNumber,
        AnswerText: q.Answer,
        AltAnswerText: q.AltAnswerText,
        Comment: q.Comment,
        Feedback: q.Feedback,
        MarkForReview: q.MarkForReview,
        Reviewed: q.Reviewed,
        Is_Component: q.Is_Component,
        Is_Requirement: q.Is_Requirement,
        Is_Maturity: q.Is_Maturity,
        ComponentGuid: q.ComponentGuid
      };

      subCatAnswers.Answers.push(answer);
    });

    this.refreshReviewIndicator();

    this.refreshPercentAnswered();

    this.questionsSvc.storeSubCategoryAnswers(subCatAnswers)
      .subscribe();
  }

  /**
   * Pushes an answer asynchronously to the API.
   * @param q
   * @param ans
   */
  storeAnswer(q: Question, newAnswerValue: string) {
    // if they clicked on the same answer that was previously set, "un-set" it
    if (q.Answer === newAnswerValue) {
      newAnswerValue = "U";
    }

    q.Answer = newAnswerValue;

    const answer: Answer = {
      QuestionId: q.QuestionId,
      QuestionNumber: q.DisplayNumber,
      AnswerText: q.Answer,
      AltAnswerText: q.AltAnswerText,
      Comment: q.Comment,
      Feedback: q.Feedback,
      MarkForReview: q.MarkForReview,
      Reviewed: q.Reviewed,
      Is_Component: q.Is_Component,
      Is_Requirement: q.Is_Requirement,
      Is_Maturity: q.Is_Maturity,
      ComponentGuid: q.ComponentGuid
    };

    this.refreshReviewIndicator();

    this.refreshPercentAnswered();

    this.questionsSvc.storeAnswer(answer)
      .subscribe();
  }

  /**
   * For ACET installations, alt answers require 3 or more characters of 
   * justification.
   */
  isAltTextRequired(q: Question) {
    if (this.configSvc.acetInstallation
      && (!q.AltAnswerText || q.AltAnswerText.trim().length < 3)) {
      return true;
    }
    return false;
  }

  /**
   * Pushes the answer to the API, specifically containing the alt text
   * @param q
   * @param altText
   */
  storeAltText(q: Question) {

    clearTimeout(this._timeoutId);
    this._timeoutId = setTimeout(() => {
      const answer: Answer = {
        QuestionId: q.QuestionId,
        QuestionNumber: q.DisplayNumber,
        AnswerText: q.Answer,
        AltAnswerText: q.AltAnswerText,
        Comment: q.Comment,
        Feedback: q.Feedback,
        MarkForReview: q.MarkForReview,
        Reviewed: q.Reviewed,
        Is_Component: q.Is_Component,
        Is_Requirement: q.Is_Requirement,
        Is_Maturity: q.Is_Maturity,
        ComponentGuid: q.ComponentGuid
      };

      this.refreshReviewIndicator();

      this.questionsSvc.storeAnswer(answer)
        .subscribe();
    }, 500);

  }

  replaceAll(origString: string, searchStr: string, replaceStr: string) {
    // escape regexp special characters in search string
    searchStr = searchStr.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

    return origString.replace(new RegExp(searchStr, 'gi'), replaceStr);
  }

  /**
   * If there are no spaces in the question text assume it's a hex string
   * @param q
   */
  applyWordBreak(q: Question) {
    if (q.QuestionText.indexOf(' ') >= 0) {
      return "normal";
    }
    return "break-all";
  }



  /**
   *
   */
  saveMFR(q: Question) {
    q.MarkForReview = !q.MarkForReview; // Toggle Bind

    const newAnswer: Answer = {
      QuestionId: q.QuestionId,
      QuestionNumber: q.DisplayNumber,
      AnswerText: q.Answer,
      AltAnswerText: q.AltAnswerText,
      Comment: '',
      Feedback: '',
      MarkForReview: q.MarkForReview,
      Reviewed: q.Reviewed,
      Is_Component: q.Is_Component,
      Is_Requirement: q.Is_Requirement,
      Is_Maturity: q.Is_Maturity,
      ComponentGuid: q.ComponentGuid
    };

    this.refreshReviewIndicator();
    this.questionsSvc.storeAnswer(newAnswer).subscribe();
  }
}
