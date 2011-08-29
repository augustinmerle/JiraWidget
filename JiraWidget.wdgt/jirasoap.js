/*
Copyright (c) 2006, Shaun Ervine
All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the 
following conditions are met:

    * Redistributions of source code must retain the above copyright notice, this list of conditions and the 
      following disclaimer.
    * Redistributions in binary form must reproduce the above copyright notice, this list of conditions and 
      the following disclaimer in the documentation and/or other materials provided with the distribution.
    * Neither the name of the <ORGANIZATION> nor the names of its contributors may be used to endorse or 
      promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND 
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED 
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE 
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE 
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL 
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR 
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED 
AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT 
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS 
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

/**
* Constants that control how the issues are displayed
*
*/
/*
const WEB_SERVICE_LOCATION = "/rpc/soap/jirasoapservice-v2";
*/
var WEB_SERVICE_LOCATION = "/rpc/soap/jirasoapservice-v2";

/**
* Holds the preference variables in short form
*/
var username = null;			
var password = null;
var jiraURL = null;
var filterId = null;

/**
* holds all the issues retrieved from the backend
*/
var issueTypeArray = null;
var issueArray = null;

/**
* Connect to the JIRA WS's and retrieve all of the issues that
* are returned for a given filter id.
*/
function retrieveIssues(aUserName, aPassword, aJiraURL, aFilterId)
{
	//set the variables to use
	username = aUserName;			
	password = aPassword;
	jiraURL = aJiraURL;
	filterId = aFilterId;

	var result;
	
	// used to generate the soap envelope
	var soapPacket = new SoapSpoofer( jiraURL + WEB_SERVICE_LOCATION, "", "login" );
	soapPacket.addProperty( "in0", username);
	soapPacket.addProperty( "in1", password);
	
	var xmlhttp = new XMLHttpRequest();
	xmlhttp.open("POST", jiraURL + WEB_SERVICE_LOCATION, true);
	xmlhttp.onreadystatechange=function() {
	  if (xmlhttp.readyState==4) 
	  {	
	  	// must always check to see if an exception has been
	  	// returned and handle it appropriatly
	  	if (checkForPossibleExceptionAndHandle(xmlhttp.responseXML))
	  	{
	  		return;
	  	}
	  	
		//get the loginReturn element
		var loginReturnElement = xmlhttp.responseXML.getElementsByTagName("loginReturn").item(0);
		
		// extract the actual session token.
		var aSessionToken = loginReturnElement.firstChild.data;
				
		// make sure we only populate the issueTypeArray
		// once
		if (issueTypeArray == null)
		{
			getIssueTypes(aSessionToken);
		}
		
		getIssuesFromFilterId(aSessionToken);
		
		getSavedFilters(aSessionToken);
		
		xmlhttp = null;
	  }
	  
	}

	xmlhttp.setRequestHeader("SOAPAction", "login")
	xmlhttp.setRequestHeader("Content-Type", "text/xml")
	xmlhttp.send(soapPacket.getEnvelope());
}

/**
* Retrieve all issues that are found using the filter
* that has been specified.
*
* If the request is successful then create and extract all 
* required information creating a combined string which is to be
* passed to the generateIssuesFromSource() to populate the issue 
* list and then procede to logout of JIRA.
* 
* Any exceptions that occur will be handled.
*
*/
function getIssuesFromFilterId(aSessionToken)
{
	// used to generate the soap envelope
	var soapPacket = new SoapSpoofer( jiraURL + WEB_SERVICE_LOCATION, "", "getIssuesFromFilter" );
	soapPacket.addProperty( "in0", aSessionToken);
	soapPacket.addProperty( "in1", filterId);

	var results;
		
	var xmlhttp = new XMLHttpRequest();
	xmlhttp.open("POST", jiraURL + WEB_SERVICE_LOCATION, true);
	
	xmlhttp.onreadystatechange=function() {
	  if (xmlhttp.readyState==4) 
	  {	
	  	// must always check to see if an exception has been
	  	// returned and handle it appropriatly
	  	if (checkForPossibleExceptionAndHandle(xmlhttp.responseXML))
	  	{
	  		return;
	  	}

		results = getJiraIssuesFromXML(xmlhttp.responseXML);

		logoutOfJIRA(aSessionToken);
		
		if( results != null ) {

			// sort by sortid
			results.sort (compFunc);
		}
		
		//This is a call back to the widget code that needs to be implemented
		buildList( results );
		
		results = null;
	  }
	}
			
	xmlhttp.setRequestHeader("SOAPAction", "getIssuesFromFilter")
	xmlhttp.setRequestHeader("Content-Type", "text/xml")
	xmlhttp.send(soapPacket.getEnvelope());

}

/**
* The function parses the issues from the response XML
*/
function getJiraIssuesFromXML(jiraXML)
{
	var itemList = jiraXML.getElementsByTagName("multiRef");
	
	var results = new Array;
	var i = 0;
	
	if (!itemList ) {
		alert("no <multiRef> element"); 
		return;
	}
	// Get all item elements subordinate to the channel element
	// For each element, get title, link and publication date. 
	// Note that all elements of an item are optional. 
	
	for(var i=0; i < itemList.length; i++) {
		var item = itemList.item(i);
		
		var title = findChild(item, 'summary');

		// we have to have the title to include the item in the list 
		if( title != null ) {

			var description = findChild(item, 'description');
			
			//start
			var anIssueType = findChild(item, 'type');
			var anIssueCode = findChild(item, 'key');
			var link = jiraURL + '/browse/' + anIssueCode.firstChild.data;

			
			results[results.length] = {title:title.firstChild.data, 
					link:(link != null ? link : null), 
					description:(description != null ? description.firstChild.data : null),
					issuetype:(issueTypeArray[anIssueType.firstChild.data] != null ? issueTypeArray[anIssueType.firstChild.data] : null),
					issuecode:(anIssueCode.firstChild.data != null ? anIssueCode.firstChild.data : null),
					sortid:(item.getAttribute("id") != null ? item.getAttribute("id").substring(2,item.getAttribute("id").length) : null)
					};
			
		}
	}
	itemList = null;
	
	return results;
}

/**
* Get the issue types available from the WS.
* This is NOT an asynchronous call.
*/
function getIssueTypes(aSessionToken)
{
	// used to generate the soap envelope
	var soapPacket = new SoapSpoofer( jiraURL + WEB_SERVICE_LOCATION, "", "getIssueTypes" );
	soapPacket.addProperty( "in0", aSessionToken);
			
	var xmlhttp = new XMLHttpRequest();
	xmlhttp.open("POST", jiraURL + WEB_SERVICE_LOCATION, false);
	xmlhttp.setRequestHeader("SOAPAction", "getIssueTypes")
	xmlhttp.setRequestHeader("Content-Type", "text/xml")
			
	xmlhttp.send(soapPacket.getEnvelope());
	var httpResponseXML = xmlhttp.responseXML;

	// if any exception occurs then return
	if (checkForPossibleExceptionAndHandle(httpResponseXML))
	{
		return;
	}
		
	//get the array of issue type elements
	var retrievedIssueTypes = xmlhttp.responseXML.getElementsByTagName("multiRef");
				
	issueTypeArray = new Array();
	for (var i = 0; i < retrievedIssueTypes.length; i++)
	{
		var issueTypeId = retrievedIssueTypes.item(i).getElementsByTagName("id").item(0).firstChild.data;
		var issueTypeIcon = retrievedIssueTypes.item(i).getElementsByTagName("icon").item(0).firstChild.data;
				
		issueTypeArray[issueTypeId] = issueTypeIcon;
	}
	
	retrievedIssueTypes = null;
}

/**
* Logout out of JIRA
*/
function logoutOfJIRA(aSessionToken)
{
	// used to generate the soap envelope
	var soapPacket = new SoapSpoofer( jiraURL + WEB_SERVICE_LOCATION, "", "logout" );
	soapPacket.addProperty( "in0", aSessionToken);
			
	var xmlhttp = new XMLHttpRequest();
	xmlhttp.open("POST", jiraURL + WEB_SERVICE_LOCATION, true);
	xmlhttp.onreadystatechange=function() {
	  if (xmlhttp.readyState==4) 
	  {	
	  }
	}
	xmlhttp.setRequestHeader("SOAPAction", "logout")
	xmlhttp.setRequestHeader("Content-Type", "text/xml")
	xmlhttp.send(soapPacket.getEnvelope());
}

/**
* Retrieve a list of all the saved filters. 
*
* And display the name of the filter on the widget.
* 
* Any exceptions that occur will be handled.
*/
function getSavedFilters(aSessionToken)
{

	// used to generate the soap envelope
	var soapPacket = new SoapSpoofer( jiraURL + WEB_SERVICE_LOCATION, "", "getSavedFilters" );
	soapPacket.addProperty( "in0", aSessionToken);
	
	var xmlhttp = new XMLHttpRequest();
	xmlhttp.open("POST", jiraURL + WEB_SERVICE_LOCATION,true);
	xmlhttp.onreadystatechange=function() {
	  if (xmlhttp.readyState==4) 
	  {	
	  	// must always check to see if an exception has been
	  	// returned and handle it appropriatly
	  	checkForPossibleExceptionAndHandle(xmlhttp.responseXML);
	  			
		//get the array of issue type elements
		var retrievedSavedFilters = xmlhttp.responseXML.getElementsByTagName("multiRef");
		
		for (var i = 0; i < retrievedSavedFilters.length; i++)
		{
			var thisfilterId = retrievedSavedFilters.item(i).getElementsByTagName("id").item(0).firstChild.data;
			
			if (filterId == thisfilterId)
			{
				//setFilterName( filterId, retrievedSavedFilters.item(i).getElementsByTagName("name").item(0).firstChild.data, 'openURL("' + generateFilterBrowseURL(filterId) +'");');
				setFilterName( filterId, retrievedSavedFilters.item(i).getElementsByTagName("name").item(0).firstChild.data, "");
			}
				
		}
	  }
	}

	xmlhttp.setRequestHeader("SOAPAction", "getSavedFilters");
	xmlhttp.setRequestHeader("Content-Type", "text/xml");
	xmlhttp.send(soapPacket.getEnvelope());
}


/**
* Helper method to always return a String.
* eg. if null return "";
*/
function extractNodeValue(aChildElement)
{
	if (aChildElement != null)
	{
		if (aChildElement.getText() != null)
		{
		
			return aChildElement.getText();
		}
		else
		{
			return "";
		}
	}
	else
	{
		return "";
	}
}
		
/**
* Checks the returned soap response to see if it contains
* any exceptions. If so it will display the exception to
* the user and return true.
*
*/
function checkForPossibleExceptionAndHandle(aPossibleException)
{
	if (aPossibleException == "")
	{
		alert("An exception occurred when attempting to reach the URL:\n" + jiraURL);
		setInfoMessage("Error Retrieving. Check preferences");
		retrievingIssues.visible = false;
		return true;
	}
	else
	{
		//get the exception element
		var exception = aPossibleException.getElementsByTagName("faultstring").item(0);

		if (exception) {
			// extract the actual session token.
			var theException = exception.firstChild.data;
			alert(theException);
			setInfoMessage( "Error: " + theException );
				
			return true;
		}
	}

	return false;
}

/**
* Truncation helper method.
*/
function trunc(s,size)
{
	var punctuation = '.,;!? ';
      	if(!size)size=30;
      	if(s.length<=size)return s;
      	p=-1;
      	for(var i=0;i<size;i++)
        	if(punctuation.indexOf(s.charAt(i))!=-1)p=i;

      	if(p==-1)p=size-1;
      	return ''+s.substr(0,p)+'...';
}

/** 
* Compare function to allow the results to be sorted in correct order
*/
function compFunc(a, b)
{
	
	if (parseInt(a.sortid) > parseInt(b.sortid))
		return 1;
	else if (parseInt(a.sortid) < parseInt(b.sortid))
		return -1;
	else
		return 0;
}
