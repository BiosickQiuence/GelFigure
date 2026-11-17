/* Feedback opens this repository's issue composer only after an explicit click. */
(function(G){
  'use strict';
  const url=G.GelFigureSupport.feedback;
  G.Feedback={open(){G.open(url,'_blank','noopener,noreferrer');},url};
})(window);
