import React from 'react';
import { Text,
   View,
   TouchableOpacity,
   TextInput,
   Image,
   StyleSheet,
  KeyboardAvoidingView ,
ToastAndroid,Alert} from 'react-native';
import * as Permissions from 'expo-permissions';
import { BarCodeScanner } from 'expo-barcode-scanner';
import * as firebase from 'firebase'
import db from '../config.js'

export default class TransactionScreen extends React.Component {
    constructor(){
      super();
      this.state = {
        hasCameraPermissions: null,
        scanned: false,
        scannedBookId: '',
        scannedStudentId:'',
        buttonState: 'normal',
        transactionMessage: ''
      }
    }

    getCameraPermissions = async (id) =>{
      const {status} = await Permissions.askAsync(Permissions.CAMERA);
      
      this.setState({
        /*status === "granted" is true when user has granted permission
          status === "granted" is false when user has not granted the permission
        */
        hasCameraPermissions: status === "granted",
        buttonState: id,
        scanned: false
      });
    }

    handleBarCodeScanned = async({type, data})=>{
      const {buttonState} = this.state

      if(buttonState==="BookId"){
        this.setState({
          scanned: true,
          scannedBookId: data,
          buttonState: 'normal'
        });
      }
      else if(buttonState==="StudentId"){
        this.setState({
          scanned: true,
          scannedStudentId: data,
          buttonState: 'normal'
        });
      }
      
    }

    initiateBookIssue = async()=>{
      //add a transaction
      db.collection("Transaction").add({
        'studentID': this.state.scannedStudentId,
        'bookID' : this.state.scannedBookId,
        'date' : firebase.firestore.Timestamp.now().toDate(),
        'transactionType': "Issue"
      })
      //change book status
      db.collection("Books").doc(this.state.scannedBookId).update({
        'bookAvailability': false
      })
      //change number  of issued books for student
      db.collection("Students").doc(this.state.scannedStudentId).update({
        'booksIssued': firebase.firestore.FieldValue.increment(1)
      })
      Alert.alert('Book issued')
      this.setState({
        scannedBookId: '',
        scannedStudentId: ''
      })
    }

    initiateBookReturn = async()=>{
      //add a transaction
      db.collection("Transaction").add({
        'studentID': this.state.scannedStudentId,
        'bookID' : this.state.scannedBookId,
        'date' : firebase.firestore.Timestamp.now().toDate(),
        'transactionType': "Return"
      })
      //change book status
      db.collection("Books").doc(this.state.scannedBookId).update({
        'bookAvailability': true
      })
      //change number  of issued books for student
      db.collection("Students").doc(this.state.scannedStudentId).update({
        'booksIssued': firebase.firestore.FieldValue.increment(-1)
      })
      Alert.alert('Book returned')
      this.setState({
        scannedBookId: '',
        scannedStudentId: ''
      })
    }


    handleTransaction = async() => {
      var transactionType = await this.checkBookEligibility();
      if (! transactionType){
        Alert.alert('The book does not exist in the library database')
      this.setState({
        scannedStudentId: '',
        scannedBookId: '',
      })
    }
    else if (transactionType === 'issue'){
      var isStudentEligible = await this.checkStudentEligibiltyForBookIssue();
      if (isStudentEligible){
        this.initiateBookIssue();
        Alert.alert('Book issued to the student')
      }
    }
    else {
      var isStudentEligible = await this.checkStudentEligibiltyForReturn();
      if (isStudentEligible){
        this.initiateBookReturn();
        Alert.alert('Book has been returned to the library')
      }
    }
  }
    checkStudentEligibiltyForBookIssue = async() => {
      const studentRep = await db.collection("Students").where("studentID","==",this.state.scannedStudentId).get();
      var isStudentEligible = '';
      if(studentRep.docs.length == 0){
        this.setState({
          scannedStudentId: '',
          scannedBookId: '',
        })
        isStudentEligible = false;
        Alert.alert('Student ID does not exist in the database')
      }
      else {
        studentRep.docs.map((doc) => {
          var student = doc.data();
          if (student.booksIssued < 2){
            isStudentEligible = true;
          }
          else {
            isStudentEligible = false;
            Alert.alert('This Student has already issued 2 books')
            this.setState({
              scannedStudentId: '',
              scannedBookId: '',
            })
          }
        })
      }return isStudentEligible
    }

    checkStudentEligibiltyForReturn = async() => {
      const transactionRef = await db.collection('Transaction').where("bookID", '==', this.state.scannedBookId.limit(1)).get();
      var isStudentEligible = '';
      transactionRef.docs.map((doc) => {
        var lastBookTransaction = doc.data();
        if (lastBookTransaction.studentId === this.state.scannedStudentId){
          isStudentEligible = true;
        }
        else {
          isStudentEligible = false;
          Alert.alert("The book was not issued by the student")
          this.setState({
            scannedStudentId: '',
            scannedBookId: '',
          })
        }
      }); return isStudentEligible 
    } 

    checkBookEligibility = async() => {
      const bookRef = await db.collection('Books').where('bookID', '==', this.state.scannedBookId).get();
      var transactionType = '';
      if (bookRef.docs.length = 0){
        transactionType = false;
      }
      else {
        bookRef.docs.map((doc) => {
          var book = doc.data();
          if (book.bookAvailability) {
            transactionType = 'issue'
          }
          else {
            transactionType = 'return'
          }
        })
      return transactionType}
      }

    render() {
      const hasCameraPermissions = this.state.hasCameraPermissions;
      const scanned = this.state.scanned;
      const buttonState = this.state.buttonState;

      if (buttonState !== "normal" && hasCameraPermissions){
        return(
          <BarCodeScanner
            onBarCodeScanned={scanned ? undefined : this.handleBarCodeScanned}
            style={StyleSheet.absoluteFillObject}
          />
        );
      }

      else if (buttonState === "normal"){
        return(
          <KeyboardAvoidingView  style={styles.container} behavior="padding" enabled>
            <View>
              <Image
                source={require("../assets/booklogo.jpg")}
                style={{width:200, height: 200}}/>
              <Text style={{textAlign: 'center', fontSize: 30}}>Wily</Text>
            </View>
            <View style={styles.inputView}>
            <TextInput 
              style={styles.inputBox}
              placeholder="Book Id"
              onChangeText={text =>this.setState({scannedBookId:text})}
              value={this.state.scannedBookId}/>
            <TouchableOpacity 
              style={styles.scanButton}
              onPress={()=>{
                this.getCameraPermissions("bookId")
              }}>
              <Text style={styles.buttonText}>Scan</Text>
            </TouchableOpacity>
            </View>

            <View style={styles.inputView}>
            <TextInput 
              style={styles.inputBox}
              placeholder="Student Id"
              onChangeText ={text => this.setState({scannedStudentId:text})}
              value={this.state.scannedStudentId}/>
            <TouchableOpacity 
              style={styles.scanButton}
              onPress={()=>{
                this.getCameraPermissions("studentId")
              }}>
              <Text style={styles.buttonText}>Scan</Text>
            </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.submitButton}
              onPress={async()=>{
                var transactionMessage = this.handleTransaction();
                this.setState(
                  {scannedBookId:'',
                   scannedStudentId:''})
              }}>
          <Text style={styles.submitButtonText}>Submit</Text>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        );
      }
    }
  }

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center'
    },
    displayText:{
      fontSize: 15,
      textDecorationLine: 'underline'
    },
    scanButton:{
      backgroundColor: '#2196F3',
      padding: 10,
      margin: 10
    },
    buttonText:{
      fontSize: 15,
      textAlign: 'center',
      marginTop: 10
    },
    inputView:{
      flexDirection: 'row',
      margin: 20
    },
    inputBox:{
      width: 200,
      height: 40,
      borderWidth: 1.5,
      borderRightWidth: 0,
      fontSize: 20
    },
    scanButton:{
      backgroundColor: '#66BB6A',
      width: 50,
      borderWidth: 1.5,
      borderLeftWidth: 0
    },
    submitButton:{
      backgroundColor: '#FBC02D',
      width: 100,
      height:50
    },
    submitButtonText:{
      padding: 10,
      textAlign: 'center',
      fontSize: 20,
      fontWeight:"bold",
      color: 'white'
    }
  });